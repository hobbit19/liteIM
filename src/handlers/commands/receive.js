const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const steps = ['token', 'type']
    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'receive',
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
                let token = message
                if (validationHandler.isSupportedToken(token)) {
                    response = {
                        response: {
                            type: 'request',
                            scope: 'receive',
                            specification: 'type'
                        }
                    }
                } else {
                    isInvalidStep = true
                }

                break
            case 1: {
                //type
                let { token } = values
                let type = message.toLowerCase()
                if (type === 'wallet' || type === 'qr' || type === 'email') {
                    try {
                        let tokens = JSON.parse(process.env.TOKENS)
                        let blockchain = tokens[token].blockchain
                        let {wallet, email} = await functionHandler.receive(user, blockchain)
                        isComplete = true

                        if (type === 'wallet') {
                            response = {
                                response: {
                                    type: 'success',
                                    scope: 'receive',
                                    specification: 'wallet',
                                    context: {wallet: wallet.toString()}
                                }
                            }
                        } else if (type === 'qr') {
                            let address = wallet.toString()
                            let url = `https://chart.googleapis.com/chart?chs=250x250&cht=qr&chl=${blockchain.toLowerCase()}:${address}`

                            response = {
                                image: {url, title: 'QR', caption: `${blockchain} ${address}`},
                                response: {
                                    type: 'success',
                                    scope: 'receive',
                                    specification: 'qr',
                                    context: {url}
                                }
                            }
                        } else if (type === 'email') {
                            response = {
                                response: {
                                    type: 'success',
                                    scope: 'receive',
                                    specification: 'email',
                                    context: {email: email.toString()}
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