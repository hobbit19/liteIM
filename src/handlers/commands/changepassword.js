const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const steps = ['code']
    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        try {
            await functionHandler.request2FA(user.id)
            response = {
                response: {
                    type: 'request',
                    scope: 'changePassword',
                    specification: 'code'
                }
            }
        } catch (response) {
            return response
        }


    } else {

        let { values } = conversationData
        if (!values) { values = {} }
        let step = Object.keys(values).length
        let isInvalidStep = false
        let isComplete = false

        switch (step) {
            case 0:
                //code
                let code = message
                if (validationHandler.isCode(code)) {
                    try {
                        await functionHandler.check2FA(service, serviceID, code, user.id)
                        response = {
                            response: {
                                type: 'request',
                                scope: 'changePassword',
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

            case 1:
                //password
                try {
                    let params = message.split(/\s+/)
                    params = params.filter(param => param.length > 0)
                    if (params.length < 2)
                        return {
                            response: {
                                type: 'failure',
                                scope: 'changePassword',
                                specification: 'password'
                            }
                        }

                    let currentPassword = params[0]
                    let newPassword = params[1]

                    await functionHandler.changePassword(
                        user,
                        currentPassword,
                        newPassword
                    )

                    isComplete = true

                    response =  {
                        response: {
                            type: 'success',
                            scope: 'changePassword',
                            specification: null,
                            context: { newPassword }
                        }
                    }
                } catch (response) {
                    return response
                }

                break
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