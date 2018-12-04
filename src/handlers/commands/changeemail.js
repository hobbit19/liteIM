const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const steps = ['newEmail', 'code']
    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'changeEmail',
                specification: 'newEmail'
            }
        }

    } else {

        let { values } = conversationData
        if (!values) { values = {} }
        let step = Object.keys(values).length
        let isInvalidStep = false
        let isComplete = false

        switch (step) {
            case 0:
                //newEmail
                let newEmail = message
                if (validationHandler.isEmail(newEmail)) {
                    try {
                        if (await functionHandler.checkIfEmailExists(newEmail)) {
                            return {
                                response: {
                                    type: 'failure',
                                    scope: 'firestore',
                                    specification: 'emailExists'
                                }
                            }
                        } else {
                            await functionHandler.request2FA(user.id)
                            response = {
                                response: {
                                    type: 'request',
                                    scope: 'changeEmail',
                                    specification: 'code'
                                }
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
                //code
                let code = message
                if (validationHandler.isCode(code)) {
                    try {
                        await functionHandler.check2FA(service, serviceID, code, user.id)

                        let { newEmail } = conversationData.values

                        response = {
                            response: {
                                type: 'request',
                                scope: 'changeEmail',
                                specification: 'password',
                                context: { newEmail }
                            }
                        }
                    } catch (response) {
                        return response
                    }
                } else {
                    isInvalidStep = true
                }

                break

            case 2: {
                //password
                let password = message
                let { newEmail } = conversationData.values
                try {
                    await functionHandler.changeEmail(user, newEmail, password)

                    isComplete = true

                    response = {
                        response: {
                            type: 'success',
                            scope: 'changeEmail',
                            specification: null,
                            context: {newEmail}
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