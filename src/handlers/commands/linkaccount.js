const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const steps = ['language', 'email', 'phone', 'code']
    const { command, params, conversationData } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {
        //this will always be an existing conversation
    } else {

        let { values } = conversationData
        if (!values) { values = {} }
        let step = Object.keys(values).length
        let isInvalidStep = false
        let isComplete = false

        switch (step) {
            case 3:
                //code
                let code = message
                let { email } = values
                if (validationHandler.isCode(code)) {
                    try {
                        let user = await functionHandler.getUserByEmail(email)
                        await functionHandler.check2FA(service, serviceID, code, user.id)
                        response = {
                            response: {
                                type: 'request',
                                scope: 'linkAccount',
                                specification: 'password'
                            }
                        }
                    } catch (response) {
                        return response
                    }
                } else {
                    isInvalidStep = true
                }
                break

            case 4: {
                //password

                let password = message
                let { language, email } = values
                try {
                    await functionHandler.getToken(email, password)
                    let user = await functionHandler.getUserByEmail(email)

                    let data = {
                        language,
                        services: {
                            [service]: serviceID.toString()
                        }
                    }

                    await functionHandler.addLiteIMUserData(user.id, data)
                    isComplete = true

                    response = {
                        response: {
                            type: 'success',
                            scope: 'linkAccount',
                            specification: null
                        }
                    }

                } catch (response) {
                    return response
                }

                break
            }
        }

        if (isInvalidStep) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'conversation',
                    specification: 'invalidStep',
                    context: { step: steps[step] }
                }
            }
        } else {
            if (isComplete) {
                await functionHandler.clearConversation(service, serviceID)
            } else {
                await functionHandler.updateConversation(service, serviceID, { [steps[step]]: message })
            }
        }

        if (!response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'conversation',
                    specification: 'unexpectedInput'
                }
            }
        }
    }

    return response

}