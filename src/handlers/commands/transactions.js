const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {
    let response
    const steps = [ 'token' ]
    const { command, params, conversationData, user } = commandData
    let { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'transactions',
                specification: 'token'
            }
        }

    } else {

        let { values } = conversationData
        if (!values) { values = {} }
        let step = Object.keys(values).length
        let isInvalidStep = false
        let isComplete = false

        let startTime, startID
        if (values.startTime && values.startID) {
            step = step - 3
            startTime = values.startTime
            startID = values.startID

            message = values.token

            conversationData.values = { }
        }

        switch (step) {
            case 0:
                //token
                let token = message.toUpperCase()
                if (validationHandler.isSupportedToken(token)) {
                    try {
                        let limit = options.transactionLimit
                            ? options.transactionLimit
                            : 3

                        let tokens = JSON.parse(process.env.TOKENS)
                        let blockchain = tokens[token.toLowerCase()].blockchain
                        let symbol = require('../symbols')(token)

                        let data = await functionHandler.transactions(service, serviceID, user.id, token, blockchain, symbol, limit, startTime, startID)
                        let { transactions } = data

                        if (transactions.length === 0) {

                            response = {
                                response: {
                                    type: 'failure',
                                    scope: 'transactions',
                                    specification: 'noTransactions'
                                }
                            }

                        } else {

                            let moreThanOne = transactions.length > 1 ? transactions.length : ''

                            response = {
                                response: {
                                    type: 'success',
                                    scope: 'transactions',
                                    specification: null,
                                    context: {moreThanOne}
                                },
                                extraData: data
                            }
                        }
                    } catch (response) {
                        return response
                    }
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