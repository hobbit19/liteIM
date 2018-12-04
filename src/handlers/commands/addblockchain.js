const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const blockchainsToAdd = [ 'ETH' ]
    const steps = [ 'code' ]
    const { command, params, conversationData, user } = commandData
    let { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        await functionHandler.request2FA(user.id)

        response = {
            response: {
                type: 'request',
                scope: 'addBlockchain',
                specification: 'code'
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
                //code
                let code = message
                if (validationHandler.isCode(code)) {
                    try {
                        await functionHandler.check2FA(service, serviceID, code, user.id)

                        response = {
                            response: {
                                type: 'request',
                                scope: 'addBlockchain',
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
                let password = message
                try {

                    let supportedTokens = JSON.parse(process.env.TOKENS)

                    let promises = []
                    blockchainsToAdd.forEach(blockchain => {
                        promises.push(
                            functionHandler.addBlockchain(blockchain, user, password)
                                .then(address => {
                                    return `${blockchain}: <pre>${address}</pre>\n`
                                })
                        )
                    })

                    let addressData = await Promise.all(promises)

                    let addresses = ''
                    addressData.forEach(address => {
                        addresses += address
                    })

                    let tokens = Object.keys(supportedTokens).map(key => {
                        return key.toUpperCase()
                    })

                    let data = { supportedTokens: tokens }

                    await functionHandler.addLiteIMUserData(user.id, data)

                    isComplete = true

                    response = {
                        response: {
                            type: 'success',
                            scope: 'addBlockchain',
                            specification: null,
                            context: {addresses}
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