const functionHandler = require('./functions')

const tokensToCheck = ['eth']
const supportedTokens = JSON.parse(process.env.TOKENS)

const commands = [
    'start',
    'signup',
    'linkaccount',
    'balance',
    'receive',
    'send',
    'changelanguage',
    'changepassword',
    'changeemail',
    'export',
    'transactions',
    'settings',
    'help',
    'clear',
    'cancel',
    'newcode',
    'more',
    'back',
    'addblockchain'
]

module.exports = async (serviceData) => {
    let { service, serviceID, message, options } = serviceData
    let user = await functionHandler.getUserByServiceID(service, serviceID)

    //handle numerical menu input
    if (!options.menuSupport && Number(message) < 10) {
        let menu = await functionHandler.getLastMenu(service, serviceID)
        if (menu) {
            let index = Number(message)
            serviceData.message = message = menu[index].callback_data
        }
    }

    let commandData = await getCommandData(service, serviceID, message, user)

    let responseData
    if (commandData.command && commands.includes(commandData.command)) {
        responseData = await require(`./commands/${commandData.command}`)(commandData, serviceData)

        //modify command parameters if the user has requested a new 2fa code
        if (commandData.command === 'newcode') {
            commandData.command = commandData.conversationData.command

            //remove one item from values to present the correct step in response
            delete commandData
                .conversationData
                .values[
                    Object.keys(commandData.conversationData.values)[0]
                ]
        }

    } else {
        commandData.command = 'uncaught'
        responseData = await require('./commands/uncaught')(commandData, serviceData)
    }

    return { commandData, responseData }

}

async function getCommandData(service, serviceID, message, user) {
    let commandData = {}
    let parsedMessage = parseParams(message)

    if (typeof parsedMessage === 'object' && parsedMessage.command) {
        if (commands.includes(parsedMessage.command.substring(1))) {
            commandData.command = parsedMessage.command.substring(1)
            commandData.params = parsedMessage.params
        }
    } else {
        //check if the command was sent without a leading slash
        if (message.charAt(0) !== '/') {
            parsedMessage = parseParams('/' + message)
            if (commands.includes(parsedMessage.command)) {
                commandData.command = parsedMessage.command
                commandData.params = parsedMessage.params
            }
        }
    }

    if (!commandData.command || commandData.command === 'newcode') {
        try {
            let conversationData = await functionHandler.getConversation(service, serviceID)

            if (conversationData) {
                conversationData.message = message
                commandData.command = (commandData.command === 'newcode') ? 'newcode' : conversationData.command
                commandData.conversationData = conversationData
            }

        } catch (e) {
            //ignore exception, no command was matched so this will result in uncaught
        }
    }

    if (user) {
        commandData.user = user

        let currencies = Object.keys(supportedTokens).map(key => {
            return key.toUpperCase()
        })

        //check if the user is missing newly supported wallets
        if (commandData.command !== 'addblockchain' &&
            (!user.supportedTokens ||
                (user.supportedTokens && user.supportedTokens.length !== currencies.length))
        ) {
            commandData = await handleUpgrades(user, commandData)
        }

    } else {
        //not a registered user, ensure onboarding engagement
        if (
            commandData.command !== 'start' &&
            commandData.command !== 'signup' &&
            commandData.command !== 'newcode' &&
            commandData.command !== 'linkaccount'
        ) {
            commandData.command = 'start'
        }
    }

    if (commandData.command === 'cancel') commandData.command = 'clear'

    return commandData
}

async function handleUpgrades(user, commandData) {

    let promises = []
    tokensToCheck.forEach(async token => {
        if (!user.supportedTokens || !user.supportedTokens[token]) {
            let blockchain = supportedTokens[token].blockchain
            promises.push(functionHandler.checkIfUserHasUpgradedWallet(blockchain, user.id))
        }
    })

    return Promise.all(promises).then(results => {
        if (results.length === 0) {
            return commandData
        } else {
            results.forEach(result => {
                if (result === false) {
                    commandData = {command: 'addblockchain', user}
                }
            })

            return commandData
        }
    })
}

// return an object { command: (String), params: (Array) }
function parseParams(str) {
    if (typeof str !== 'string') return
    let params = str.split(/\s+/)
    params = params.filter(param => param.length > 0)
    if (params.length === 0) return
    let command = params.shift().toLowerCase()
    if (!/^\/\S+/.test(command)) return
    return { command, params }
}