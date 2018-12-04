const functionHandler = require('./functions')

module.exports = async (serviceData, commandData, responseData, responseMessage = null) => {

    const { service, serviceID, message, options } = serviceData
    let { command, params, conversationData, user } = commandData
    const { response, extraData } = responseData

    let step, menuSize
    let startIndex = 0
    let previousStartIndex = 0

    command = command.toLowerCase()

    //if the user is in a conversation, determine which step they are on
    if (conversationData && conversationData.values) {
        step = Object.keys(conversationData.values).length + 1
    }
    else if (conversationData && !conversationData.values) {
        step = 1
    }

    //obtain previous state information if the user is paging through a menu
    if (options.menuSupport) {
        menuSize = options.menuSize || 5

        if (command === 'more' || command === 'back') {
            let pagingData = handlePaging(command, message, menuSize)

            command = pagingData.command
            step = pagingData.step
            response.type = pagingData.responseType
            startIndex = pagingData.startIndex
            previousStartIndex = pagingData.previousStartIndex
        }
    }

    try {
        //get the menu data based on the current state
        let { rootMenus, menu } = getMenu(response.type, user, command, step)

        //if menu has more options than the service allows, truncate menu
        if (options.menuSupport) {
            if (Array.isArray(menu) && menu.length > menuSize) {
                menu = truncateMenu(menu, menuSize, command, step, response.type, startIndex, previousStartIndex)
            }
        }

        //replace placeholders with values from extraData
        if (extraData && Object.keys(extraData).length > 0) {
            menu = replaceContextData(rootMenus, menu, command, extraData, step)
        }

        //ensure resulting menu is an array of objects
        if (!Array.isArray(menu) || typeof menu === 'string') {
            menu = JSON.parse(menu)
        }

        //inject language specific strings and handle secure password buttons
        menu = await finalizeButtons(menu, serviceData, commandData, command)

        //if no menu support, append numeric menu to response message
        if (responseMessage && !options.menuSupport) {
            if (!(command === 'send' && step === 4)) { //cant allow neumeric menus when the user is entering the amount to send
                responseMessage = await setupNumericMenu(menu, responseMessage, service, serviceID)
            }
            menu = false
        }

        return { menu, responseMessage }
        
    } catch (err) {
        throw err
    }
}


const getMenu = (responseType, user, command, step) => {

    let rootMenus = (responseType === 'failure') ? menus.error : menus.success
    if (command === 'start') {
        if (!user) step = 0
        else step = 1
    }

    if (command === 'help') {
        step = 0
    }

    let menu
    if (step) {
        menu = JSON.parse(JSON.stringify(rootMenus[`${command}${step}`]))
        if (typeof menu === 'object' && menu.main) {
            menu = JSON.parse(JSON.stringify(rootMenus[`${command}${step}`].main))
        }
    } else {
        menu = rootMenus[command]
            ? rootMenus[command].main
                ? JSON.parse(JSON.stringify(rootMenus[command].main))
                : JSON.parse(JSON.stringify(rootMenus[command]))
            : []
    }

    if (menu === 'main') menu = JSON.parse(JSON.stringify(mainMenu))

    if (menu[0] === 'languages') {
        let backButton = menu[1]
        menu = []

        const languages = process.env.LANGUAGES.split(',')
        languages.forEach(lang => {
            menu.push( { text: lang, callback_data: lang } )
        })
        menu.push(backButton)
    }
    else if (menu[0] === 'tokens') {
        let backButton = menu[1]
        menu = []

        const tokens = JSON.parse(process.env.TOKENS)
        for (let token in tokens) {
            if (tokens.hasOwnProperty(token)) {
                menu.push( { text: token.toUpperCase(), callback_data: token } )
            }
        }

        menu.push(backButton)
    }

    return { rootMenus, menu }
}


const setupNumericMenu = async (menu, responseMessage, service, serviceID) => {
    let menuContent = ''
    let urlItems = []
    if (menu && menu.length > 0) {
        menuContent += '\n\n'
        for (let i = 0; i < menu.length; i++) {
            let item = menu[i]
            if (item.url) {
                responseMessage += '\n\n' + item.url
                urlItems.push(i)
            } else {
                menuContent += `${i - urlItems.length}: ${item.text} ${i === menu.length - 1 ? '' : '\n'}`
            }
        }

        urlItems.forEach(index => {
            menu.splice(index, 1)
        })

        await functionHandler.setLastMenu(service, serviceID, menu)
        return responseMessage + menuContent
    }
}


const replaceContextData = (rootMenus, menu, command, extraData, step) => {
    let rows = []
    for (let key in extraData) {
        if (!extraData.hasOwnProperty(key)) continue

        if (Array.isArray(extraData[key])) {
            let template =  step ? rootMenus[`${command}${step}`][key] : rootMenus[command][key]

            extraData[key].forEach(datum => {
                let row = template
                for (let k in datum) {
                    if (!datum.hasOwnProperty(k)) continue

                    row = row.replace('${' + k + '}', datum[k])
                }
                rows.push(row)
            })
            menu = menu.replace('${' + key + '}', rows)
        } else {
            if (typeof extraData[key] === 'boolean') {
                if (extraData[key]) {

                    if (step) {
                        menu = menu.replace(
                            '${' + key + '}',
                            JSON.stringify(rootMenus[`${command}${step}`][key]) + ','
                        )
                    } else {
                        menu = menu.replace(
                            '${' + key + '}',
                            JSON.stringify(rootMenus[command][key]) + ','
                        )
                    }
                } else {
                    menu = menu.replace('${' + key + '}', '')
                }
            } else {
                if (typeof menu === 'string') {
                    menu = menu.replace('${' + key + '}', extraData[key])
                }
            }
        }
    }

    return menu
}


const getLanguageStrings = (options, user, conversationData, message) => {

    let lang = options.defaultLanguage || 'en'
    if (user && user.language) {
        lang = user.language
    } else {
        if (conversationData) {
            if (conversationData.values && conversationData.values.language) {
                lang = conversationData.values.language
            } else {
                const languages = process.env.LANGUAGES.split(',')
                if (languages.includes(message)) {
                    lang = message
                }
            }
        }
    }

    //load the language strings.
    //if the file doesn't exist, load the English strings
    try {
        return require(`../languages/${lang}.json`)
    } catch (e) {
        return require('../languages/en.json')
    }
}


const finalizeButtons = async (menu, serviceData, commandData, command) => {
    let { service, serviceID, message, options } = serviceData
    let { conversationData, user } = commandData

    let i = 0
    let languageStrings = getLanguageStrings(options, user, conversationData, message)

    menu.forEach(button => {
        if (button.string) {
            button.text = languageStrings.buttons[button.string]
            delete button.string
        }

        if (button.type === 'securePassword') {
            let email = ''
            let isUser = false
            if (command === 'linkaccount') {
                isUser = true
                email = conversationData.values.email
            } else {
                isUser = !!user //true if user
                email = user ? user.email : ''
            }

            let urlPage, params
            if (command === 'changepassword') {
                urlPage = 'password-change'
                params = 'service=' + service + '&serviceID=' + serviceID + '&email=' + email + '&isUser=' + isUser
            }

            else if (command === 'export') {
                let type
                if (conversationData.values.type === 'key') {
                    type = 'privateKey'
                } else {
                    type = 'phrase'
                }

                let currency = 'LTC'
                if (conversationData.values.token) {
                    currency = conversationData.values.token
                }

                urlPage = 'reveal-key'
                params = 'email=' + email + '&type=' + type + '&currency=' + currency.toUpperCase()
            }

            else {
                urlPage = 'password-form'
                params = 'service=' + service + '&serviceID=' + serviceID + '&email=' + email + '&isUser=' + isUser
            }

            button.url = 'https://www.lite.im/' + urlPage + '?' + params

            menu[i] = button
        }
        i++
    })

    return menu
}


const handlePaging = (command, message, menuSize) => {

    let pagingData = {}
    if (command === 'more') {
        let params = message.split(/\s+/)

        if (params[1]) {
            pagingData.startIndex = params[1]
        }
        if (params[2]) {
            pagingData.previousStartIndex = params[2]
        }
        if (params[3]) {
            pagingData.responseType = params[3]
        }
        if (params[4]) {
            pagingData.command = params[4]
        }
        if (params[5]) {
            pagingData.step = Number(params[5])
        }
    }
    else if (command === 'back') {
        let params = message.split(/\s+/)
        if (params[1]) {
            pagingData.startIndex = params[1]
        }
        if (params[2]) {
            pagingData.responseType = params[2]
        }
        if (params[3]) {
            pagingData.command = params[3]
        }
        if (params[4]) {
            pagingData.step = Number(params[4])
        }

        if (pagingData.startIndex > menuSize - 1) {
            pagingData.previousStartIndex = pagingData.startIndex - (menuSize - 2)
        } else {
            pagingData.previousStartIndex = pagingData.startIndex - (menuSize - 1)
        }
    }

    return pagingData
}


const truncateMenu = (menu, menuSize, command, step, responseType, startIndex, previousStartIndex) => {
    let back, next = false

    //account for back button
    if (startIndex > 0) {
        back = true
        menuSize -= 1
    }

    //account for next button
    if ((menu.length - startIndex) - menuSize > 0) {
        next = true
        menuSize -= 1
    }

    //let sliceEnd = (sliceBegin + menuSize - 1)
    let endIndex = Number(startIndex) + Number(menuSize)

    menu = menu.slice(startIndex, endIndex)

    if (!step) step = ''

    if (back) {
        menu.unshift({ string: 'back', callback_data: `/back ${previousStartIndex} ${responseType} ${command} ${step}` })
    }

    if (next) {
        menu.push({string: 'more', callback_data: `/more ${endIndex} ${startIndex} ${responseType} ${command} ${step}`})
    }

    return menu
}


const buttons = {
    clear: { string: 'cancel', callback_data: '/clear' },
    cancel: { string: 'cancel', callback_data: '/help' },
    back: { string: 'back', callback_data: '/help' },
    more: { string: 'more', callback_data: '/more' },
    securePassword: { string: 'securePassword', type: 'securePassword' }
}

const mainMenu = [
    { string: 'send', callback_data: '/send' },
    { string: 'receive', callback_data: '/receive' },
    { string: 'balance', callback_data: '/balance' },
    { string: 'transactions', callback_data: '/transactions' },
    { string: 'export', callback_data: '/export' },
    { string: 'settings', callback_data: '/settings' }
]

const menus = {
    success: {
        start: [{ string: 'register', callback_data: '/signup' }],
        start1: 'main',
        help: 'main',
        clear: 'main',
        main: 'main',
        settings: [
            { string: 'changePassword', callback_data: '/changepassword'},
            { string: 'changeEmail', callback_data: '/changeemail' },
            { string: 'changeLanguage', callback_data: '/changelanguage' },
            buttons.back
        ],
        receive: [
            'tokens',
            buttons.back
        ],
        receive1: [
            { string: 'wallet', callback_data: 'wallet' },
            { string: 'qr', callback_data: 'qr' },
            { string: 'email', callback_data: 'email' },
            buttons.cancel
        ],
        receive2: [ buttons.back ],
        balance: [
            'tokens',
            buttons.back
        ],
        balance1: 'main',
        transactions: [
            'tokens',
            buttons.back
        ],
        transactions1: {
            main:
            '[ ${transactions}, ${more} ' +
            JSON.stringify({ string: 'back', callback_data: '/help' }) +
            ' ]',
            transactions: '{ "text": "${direction} ${date} ${symbol}${amount}", "url": "${url}" }',
            more: { string: 'more', callback_data: '/moretransactions' }
        },
        changeemail: [buttons.clear],
        changeemail1: [
            { string: 'newCode', callback_data: '/newcode' },
            buttons.clear
        ],
        changeemail2: [
            buttons.securePassword,
            buttons.clear
        ],
        changeemail3: 'main',
        changepassword: [
            { string: 'newCode', callback_data: '/changepassword' },
            buttons.clear
        ],
        changepassword1: [
            buttons.securePassword,
            buttons.clear
        ],
        changepassword2: 'main',
        changelanguage: [
            'languages',
            buttons.back
        ],
        changelanguage1: 'main',
        enable2fa: [],
        enable2fa1: [
            { string: 'changeNumber', callback_data: '/enable2fa' },
            { string: 'newCode', callback_data: '/newcode' }
        ],
        enable2fa2: [
            buttons.securePassword,
            { string: 'cancel', callback_data: '/enable2fa' }
        ],
        enable2fa3: 'main',
        export: [
            'tokens',
            buttons.back
        ],
        export1: [
            { string: 'key', callback_data: 'key' },
            { string: 'phrase', callback_data: 'phrase' },
            buttons.clear
        ],
        export2: [
            { string: 'newCode', callback_data: '/newcode' },
            buttons.clear
        ],
        export3: [
            buttons.securePassword,
            buttons.clear
        ],
        export4: 'main',
        send: [
            'tokens',
            buttons.back
        ],
        send1: [buttons.clear],
        send2: '[{ "string": "USD", "callback_data": "$" }, { "text": "${token}", "callback_data": "${symbol}" }, { "string": "cancel", "callback_data": "/clear" }]',
        send3: [
            { string: 'sendAll', callback_data: 'all' },
            buttons.clear
        ],
        send4: [
            { string: 'newCode', callback_data: '/newcode' },
            buttons.clear
        ],
        send5: [
            buttons.securePassword,
            buttons.clear
        ],
        send6:
            '[{ "text": "${txid}", "url": "${url}" }, { "string": "mainMenu", "callback_data": "/start" }]',
        notifier:
            '[{ "text": "${txid}", "url": "${url}" }, { "string": "mainMenu", "callback_data": "/start" }]',
        signup: [
            'languages',
            { string: 'cancel', callback_data: '/signup' }
        ],
        signup1: [{ string: 'cancel', callback_data: '/signup' }],
        signup2: [{ string: 'cancel', callback_data: '/signup' }],
        signup3: [
            { string: 'newCode', callback_data: '/newcode' },
            { string: 'cancel', callback_data: '/signup' }
        ],
        signup4: [
            buttons.securePassword,
            { string: 'cancel', callback_data: '/signup' }
        ],
        signup5: [{ string: 'letsBegin', callback_data: '/help' }],
        linkaccount2: [
            { string: 'newCode', callback_data: '/newcode' },
            { string: 'cancel', callback_data: '/signup' }
        ],
        linkaccount3: [
            { string: 'newCode', callback_data: '/newcode' },
            { string: 'cancel', callback_data: '/signup' }
        ],
        linkaccount4: [
            buttons.securePassword,
            { string: 'cancel', callback_data: '/signup' }
        ],
        linkaccount5: [{ string: 'letsBegin', callback_data: '/help' }],
        broadcast: 'main',
        addblockchain: [
            { string: 'newCode', callback_data: '/newcode' },
            { string: 'cancel', callback_data: '/addblockchain' }
        ],
        addblockchain1: [ buttons.securePassword ],
        addblockchain2: 'main'
    },
    error: {
        receive: [
            'tokens',
            buttons.back
        ],
        receive1: [
            { string: 'wallet', callback_data: 'wallet' },
            { string: 'qr', callback_data: 'qr' },
            { string: 'email', callback_data: 'email' },
            buttons.cancel
        ],
        receive2: [
            { string: 'wallet', callback_data: 'wallet' },
            { string: 'qr', callback_data: 'qr' },
            { string: 'email', callback_data: 'email' },
            buttons.cancel
        ],
        balance: [
            'tokens',
            buttons.back
        ],
        balance1: [buttons.clear],
        changeemail: [buttons.clear],
        changeemail1: [buttons.clear],
        changeemail2: [
            { string: 'newCode', callback_data: '/newcode' },
            buttons.clear
        ],
        changeemail3: [buttons.clear],
        changepassword: [buttons.clear],
        changepassword1: [
            { string: 'newCode', callback_data: '/changepassword' },
            buttons.clear
        ],
        changepassword2: [
            { string: 'newCode', callback_data: '/changepassword' },
            buttons.clear
        ],
        changelanguage1: [buttons.clear],
        enable2fa: [
            { string: 'enable2fa', callback_data: '/enable2fa' }
        ],
        enable2fa1: [{ string: 'tryAgain', callback_data: '/enable2fa' }],
        enable2fa2: [
            { string: 'changeNumber', callback_data: '/enable2fa' },
            { string: 'newCode', callback_data: '/newcode' }
        ],
        enable2fa3: [{ string: 'tryAgain', callback_data: '/enable2fa' }],
        export: [
            'tokens',
            buttons.back
        ],
        export1: [buttons.clear],
        export2: [buttons.clear],
        export3: [
            { string: 'newCode', callback_data: '/newcode' },
            buttons.clear
        ],
        export4: [buttons.clear],
        send: [
            'tokens',
            buttons.back
        ],
        send1: [
            { string: 'receive', callback_data: '/receive' },
            buttons.clear
        ],
        send2: [buttons.clear],
        send3: [buttons.clear],
        send4: [buttons.clear],
        send5: [
            { string: 'newCode', callback_data: '/newcode' },
            buttons.clear
        ],
        send6: [buttons.clear],
        signup: [
            { text: 'en', callback_data: 'en' },
            { string: 'cancel', callback_data: '/signup' }
        ],
        signup1: [{ string: 'cancel', callback_data: '/signup' }],
        signup2: [{ string: 'cancel', callback_data: '/signup' }],
        signup3: [{ string: 'cancel', callback_data: '/signup' }],
        signup4: [
            { string: 'newCode', callback_data: '/newcode' },
            { string: 'cancel', callback_data: '/signup' }
        ],
        signup5: [{ string: 'tryAgain', callback_data: '/signup' }],
        clear: 'main',
        transactions: [
            'tokens',
            buttons.back
        ],
        transactions1: 'main',
        uncaught: [{ string: 'cancel', callback_data: '/help' }],
        linkaccount2: [{ string: 'cancel', callback_data: '/signup' }],
        linkaccount3: [{ string: 'cancel', callback_data: '/signup' }],
        linkaccount4: [{ string: 'cancel', callback_data: '/signup' }],
        addblockchain: [
            { string: 'newCode', callback_data: '/newcode' },
            { string: 'cancel', callback_data: '/signup' }
        ],
        addblockchain1: [ buttons.securePassword ],
        addblockchain2: [ buttons.securePassword ]
    }
}