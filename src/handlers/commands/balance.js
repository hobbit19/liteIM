const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const steps = [ 'token' ]
    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'balance',
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

                    let tokens = JSON.parse(process.env.TOKENS)
                    let blockchain = tokens[token].blockchain

                    response = await functionHandler
                        .balance(user.id, token, blockchain)
                        .then(async balance => {
                            try {
                                let rate = await functionHandler.getRate(token)

                                if (rate) {
                                    let balanceUSD = (Number(balance) * rate).toFixed(2)
                                    return {
                                        response: {
                                            type: 'success',
                                            scope: 'balance',
                                            specification: 'withoutUnconfirmedUSD',
                                            context: {token: token.toUpperCase(), balance, balanceUSD}
                                        }
                                    }
                                } else {
                                    return {
                                        response: {
                                            type: 'success',
                                            scope: 'balance',
                                            specification: 'withoutUnconfirmed',
                                            context: {token: token.toUpperCase() , balance}
                                        }
                                    }
                                }
                            } catch (err) {
                                return {
                                    response: {
                                        type: 'success',
                                        scope: 'balance',
                                        specification: 'withoutUnconfirmed',
                                        context: {token: token.toUpperCase() , balance}
                                    }
                                }
                            }
                        })

                    if (response) isComplete = true

                } else {
                    isInvalidStep = true
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