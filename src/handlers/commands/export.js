const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const steps = ['token', 'type', 'code']
    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'export',
                specification: 'token'
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
                //token
                response = {
                    response: {
                        type: 'request',
                        scope: 'export',
                        specification: 'type'
                    }
                }

                break

            case 1:
                //type
                let type = message.toLowerCase()
                if (type === 'key' || type === 'phrase') {
                    try {
                        await functionHandler.request2FA(user.id)
                        response = {
                            response: {
                                type: 'request',
                                scope: 'export',
                                specification: 'code'
                            }
                        }
                    } catch (response) {
                        return response
                    }

                } else {
                    isInvalidStep = true
                }

                break

            case 2:
                //code
                let code = message
                if (validationHandler.isCode(code)) {
                    try {
                        await functionHandler.check2FA(service, serviceID, code, user.id)

                        response = {
                            response: {
                                type: 'request',
                                scope: 'export',
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

            case 3: {
                //password
                let password = message
                let { token, type } = conversationData.values

                try {
                    let tokens = JSON.parse(process.env.TOKENS)
                    let blockchain = tokens[token].blockchain

                    let secret = await functionHandler.exportWallet(user, type, password, blockchain)

                    secret = options.htmlSupport
                        ? `<pre>${secret}</pre>`
                        : secret

                    response = {
                        response: {
                            type: 'success',
                            scope: 'export',
                            specification: null,
                            context: { secret }
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