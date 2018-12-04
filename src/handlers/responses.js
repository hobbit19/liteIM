module.exports = async (serviceData, commandData, responseData) => {

    if (!responseData) throw false

    try {

        const { service, serviceID, message, options } = serviceData
        const { command, params, conversationData, user } = commandData
        const { response } = responseData

        const { type, scope, specification, context } = response

        //detect the language to use, or default to English
        let language = options.defaultLanguage || 'en'
        if (user && user.language) {
            language = user.language
        } else {
            if (conversationData) {
                if (conversationData.values && conversationData.values.language) {
                    language = conversationData.values.language
                } else {
                    const languages = process.env.LANGUAGES.split(',')
                    if (languages.includes(message)) {
                        language = message
                    }
                }
            }
        }

        const emojiStrings = require(`../languages/emojis.json`)


        let menuSupport = options.menuSupport ? 'menuSupport' : 'noMenuSupport'
        let responses = getResponseValues(language, menuSupport, type, scope, specification)

        //if there are multiple response options, choose one randomly
        let responseString
        if (Array.isArray(responses)) {
            if (responses.length > 1) {
                let rnd = Math.floor(Math.random() * responses.length)
                responseString = responses[rnd]
            } else responseString = responses[0]
        } else responseString = responses

        //handle dynamic response values
        if (context) {
            for (let key in context) {
                if (context.hasOwnProperty(key)) {
                    let value = context[key]
                    let regex = new RegExp('(\\$)(\\{)('+  key + ')(\\})', "g");
                    responseString = responseString.replace(regex, value)
                }
            }
        }

        //add random emojis
        let emoji = ''
        if (responseString && !responseString.includes("\n") && !responseString.includes("Example")) {
            if (options.menuSupport || response.length <= 150) {
                let emojis = emojiStrings[type]
                let rnd = Math.floor(Math.random() * (emojis.length * 2)) //this gives us a 50% chance of having an emoji
                emoji = emojis[rnd] ? emojis[rnd] : ''
                responseString += ` ${emoji}`
            }
        }

        if (!options.menuSupport) {
            let numericMenuInstructions = getResponseValues(language, menuSupport, 'request', 'numericInstructions')
            responseString += ` ${numericMenuInstructions}`
        }

        let { menu, responseMessage } = await require('./menus')(serviceData, commandData, responseData, responseString)

        return { message: responseMessage, menu }

    } catch (err) {
        console.log("responder error: ", err)

        let languageStrings = require('../languages/en.json')

        let responseMessage = languageStrings['menuSupport']['failure']['generic'][0]
        let backString = languageStrings['buttons']['back']
        let menu = [{ text: backString, callback_data: '/help' }]

        return { message: responseMessage, menu }
    }

}

const getResponseValues = (language, menuSupport, type, scope, specification) => {

    //load the language strings; if the file doesn't exist, load the English strings
    let languageStrings
    try {
        languageStrings = require(`../languages/${language}.json`)
    } catch (e) {
        languageStrings = require('../languages/en.json')
    }

    let responses
    if (specification) {
        if (languageStrings[menuSupport] &&
            languageStrings[menuSupport][type] &&
            languageStrings[menuSupport][type][scope] &&
            languageStrings[menuSupport][type][scope][specification]
        ){
            responses = languageStrings[menuSupport][type][scope][specification]
        }
        else if (menuSupport === 'noMenuSupport' &&
            languageStrings.menuSupport &&
            languageStrings.menuSupport[type] &&
            languageStrings.menuSupport[type][scope] &&
            languageStrings.menuSupport[type][scope][specification]
        ) {
            //there is not a noMenuSupport-specific response, so use the normal one
            responses = languageStrings.menuSupport[type][scope][specification]
        }

    } else {
        if (languageStrings[menuSupport] &&
            languageStrings[menuSupport][type] &&
            languageStrings[menuSupport][type][scope]
        ) {
            responses = languageStrings[menuSupport][type][scope]
        }
        else if (menuSupport === 'noMenuSupport' &&
            languageStrings.menuSupport &&
            languageStrings.menuSupport[type] &&
            languageStrings.menuSupport[type][scope]
        ) {
            //there is not a noMenuSupport-specific response, so use the normal one
            responses = languageStrings.menuSupport[type][scope]
        }
    }

    //if there was not a response string for a language other than English, check the English strings
    if (!responses && language !== 'en') {
        return getResponseValues('en', menuSupport, type, scope, specification)
    }

    return responses
}