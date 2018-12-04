const functionHandler = require('./functions')

module.exports = async (data) => {
    try {
        let { user, sender, txid, amount, token } = data

        let services = user.services
        for (let service in services) {
            if (services.hasOwnProperty(service)) {
                const serviceHandler = require(`./services/${service}`)
                let serviceID = user.services[service]

                token = token.toLowerCase()
                let tokens = JSON.parse(process.env.TOKENS)
                let blockchain = tokens[token].blockchain
                let symbol = require('./symbols')(token)

                let url = functionHandler.getBlockExplorerURL(blockchain, txid)
                let options = serviceHandler.options

                const serviceData = { service, serviceID, options }
                const commandData = { command: 'notifier', user }

                const responseData = {
                    response: {
                        type: 'success',
                        scope: 'send',
                        specification: 'recipient',
                        context: { amount, sender, symbol }
                    },
                    extraData: { txid, url }
                }

                const { message, menu } = await require('./responses')(serviceData, commandData, responseData)

                const payload = await serviceHandler.prepareResponse(message, menu, serviceData, responseData)

                await serviceHandler.send(payload)
            }
        }

    } catch (e) {
        console.log(e)
    }
}