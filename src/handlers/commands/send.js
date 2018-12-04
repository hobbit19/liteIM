const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {
    let response
    const steps = ['token', 'to', 'currency', 'amount', 'code']
    const { command, params, conversationData, user } = commandData
    let { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'send',
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

                    let balance = await functionHandler.balance(user.id, token, blockchain)
                    if (balance) {
                        if (Number(balance) > 0) {
                            response = {
                                response: {
                                    type: 'request',
                                    scope: 'send',
                                    specification: 'to',
                                    context: {
                                        token: token.toUpperCase()
                                    }
                                }
                            }
                        } else {
                            response = {
                                response: {
                                    type: 'failure',
                                    scope: 'send',
                                    specification: 'zeroBalance',
                                    context: { token }
                                }
                            }
                        }
                    } else {
                        response = {
                            response: {
                                type: 'failure',
                                scope: 'send',
                                specification: 'fetchBalance'
                            }
                        }
                    }
                } else {
                    isInvalidStep = true
                }

                break

            case 1: {
                //to
                let to = message

                let tokens = JSON.parse(process.env.TOKENS)
                let symbol = require('../symbols')(values.token)

                if (validationHandler.isEmail(to)) {
                    if (functionHandler.checkIfEmailExists(to)) {
                        response = {
                            response: {
                                type: 'request',
                                scope: 'send',
                                specification: 'currency',
                                context: {token: values.token.toUpperCase(), symbol }
                            },
                            extraData: {
                                token: values.token.toUpperCase(),
                                symbol
                            }
                        }
                    } else {
                        response = {
                            response: {
                                type: 'failure',
                                scope: 'send',
                                specification: 'notRegistered',
                                context: {entry: to}
                            }
                        }
                    }
                }
                else if (validationHandler.isPhoneNumber(to)) {
                    if (functionHandler.checkIfPhoneNumberExists(to)) {
                        response = {
                            response: {
                                type: 'request',
                                scope: 'send',
                                specification: 'currency',
                                context: {token: values.token.toUpperCase(), symbol }
                            },
                            extraData: {
                                token: values.token.toUpperCase(),
                                symbol
                            }
                        }
                    } else {
                        response = {
                            response: {
                                type: 'failure',
                                scope: 'send',
                                specification: 'notRegistered',
                                context: {entry: to}
                            }
                        }
                    }
                }
                else if (validationHandler.isCryptoAddress(values.token, to)) {
                    response = {
                        response: {
                            type: 'request',
                            scope: 'send',
                            specification: 'currency',
                            context: {token: values.token.toUpperCase(), symbol }
                        },
                        extraData: {
                            token: values.token.toUpperCase(),
                            symbol
                        }
                    }
                } else {
                    isInvalidStep = true
                }

                break
            }

            case 2: {
                //currency
                let currency = message.toLowerCase()

                let tokens = JSON.parse(process.env.TOKENS)
                let symbol = require('../symbols')(values.token)

                if (currency === 'usd' || currency === 'u' || currency === 'dollars') currency = '$'
                else if (currency === 'ltc' || currency === 'l' || currency === 'ł' || currency === 'litecoin') currency = 'Ł'
                else if (currency === 'eth' || currency === 'ξ' || currency === 'ethereum' || currency === 'Ξ') currency = 'Ξ'
                else if (currency === 'ztx') currency = 'ZTX'

                if (currency === '$' || currency === 'Ł' || currency === 'Ξ' || currency === 'ZTX') {

                    let {to} = conversationData.values

                    response = {
                        response: {
                            type: 'request',
                            scope: 'send',
                            specification: 'amount',
                            context: {to, currency}
                        }
                    }

                } else {
                    isInvalidStep = true
                }

                break
            }

            case 3:
                //amount
                let amount = message

                let tokens = JSON.parse(process.env.TOKENS)
                let blockchain = tokens[values.token].blockchain

                if (amount === 'all') {

                    let balance = await functionHandler.balance(user.id, values.token, blockchain)

                    if (balance) {
                        amount = Number(balance)

                        if (values.token.toUpperCase() === 'ETH') {
                            amount = balance - 0.000441
                            message = amount
                        }

                        if (conversationData.values.currency === '$') {
                            try {
                                let rate = await functionHandler.getRate(values.token)
                                amount = (amount * rate).toFixed(2)
                                message = amount

                            } catch (response) {
                                return response
                            }
                        } else {
                            message = amount
                        }
                    } else {
                        return {
                            response: {
                                type: 'failure',
                                scope: 'send',
                                specification: 'fetchBalance'
                            }
                        }
                    }
                } else {
                    if (isNaN(amount.charAt(0))) amount = amount.substr(1)
                }

                if (conversationData.values.currency === '$') {
                    try {
                        let rate = await functionHandler.getRate(values.token)
                        message = (amount / rate).toFixed(4)

                    } catch (response) {
                        return response
                    }
                }

                try {
                    await functionHandler.request2FA(user.id)

                    response = {
                        response: {
                            type: 'request',
                            scope: 'send',
                            specification: 'code'
                        }
                    }
                } catch (response) {
                    return response
                }

                break

            case 4:
                //code
                let code = message
                if (validationHandler.isCode(code)) {
                    try {
                        await functionHandler.check2FA(service, serviceID, code, user.id)

                        let amount = conversationData.values.amount
                        let to = conversationData.values.to

                        let tokens = JSON.parse(process.env.TOKENS)

                        let symbol = require('../symbols')(values.token)
                        
                        if (amount !== 'all') amount = `${symbol}${amount}`

                        response = {
                            response: {
                                type: 'request',
                                scope: 'send',
                                specification: 'password',
                                context: { amount, to }
                            }
                        }

                    } catch (response) {
                        return response
                    }
                } else {
                    isInvalidStep = true
                }
                break

            case 5: {
                //password
                let password = message
                let { to, amount, token } = conversationData.values

                try {

                    let tokens = JSON.parse(process.env.TOKENS)
                    let blockchain = tokens[token].blockchain

                    let data = await functionHandler.send(token, blockchain, to, amount, password, user)
                    let { txid, toUser } = data

                    let url = functionHandler.getBlockExplorerURL(blockchain, txid)

                    let extraData = {
                        txid: txid,
                        url
                    }

                    let notifier
                    if (toUser) {
                        notifier = {
                            user: toUser,
                            sender: user.email,
                            txid,
                            amount,
                            token
                        }
                    }

                    isComplete = true

                    response = {
                        response: {
                            type: 'success',
                            scope: 'send',
                            specification: 'sender'
                        },
                        extraData,
                        notifier
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