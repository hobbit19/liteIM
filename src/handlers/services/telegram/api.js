const functionHandler = require('../../functions')
const Telegraf = require('telegraf')
const { Markup } = Telegraf

const TelegramAPIKey =
    (process.env.STAGE === 'production')
        ? process.env.TELEGRAM_PROD_API_KEY
        : process.env.TELEGRAM_DEV_API_KEY

const service = 'telegram'

const sendMessage = async (serviceID, text, opts = {}) => {
    opts.parse_mode = 'html'
    return new Telegraf(TelegramAPIKey)
        .telegram
        .sendMessage(serviceID, text, opts)
        .then(success => {
            return functionHandler.setBotMessageID(
                service,
                serviceID,
                success.message_id
            )
        })
        .catch(failure => {
            console.log(`Error sending message to ${serviceID}`, failure)
        })
}


const sendPhoto = async (serviceID, url, caption, opts = {}) => {
    if (caption) opts.caption = caption
    return new Telegraf(TelegramAPIKey)
        .telegram
        .sendPhoto(serviceID, url, opts)
        .then(success => {
            return functionHandler.setBotMessageID(
                service,
                serviceID,
                success.message_id
            )
        })
        .catch(failure => {
            console.log(`Error sending message to ${serviceID}`, failure)
        })
}


const editMessage = async (serviceID, messageID, text, extra = {}) => {
    if (!messageID) {
        let messageIdToEdit = await functionHandler.getBotMessageID(service, serviceID)
        messageID = messageIdToEdit.messageID
    }

    extra.parse_mode = 'html'

    return new Telegraf(TelegramAPIKey)
        .telegram
        .editMessageText(serviceID, messageID, null, text, extra)
}


const deleteMessage = async (serviceID, messageID) => {
    if (!messageID) {
        let messageIdToDelete = await functionHandler.getBotMessageID(service, serviceID)
        messageID = messageIdToDelete.messageID
    }

    return new Telegraf(TelegramAPIKey)
        .telegram
        .deleteMessage(serviceID, messageID)
        .catch(failure => {
            console.log(`Could not delete message ${messageID} for ${serviceID}.`)
        })
}


const inlineKeyboard = (buttonLayout) => {
    if (buttonLayout) {
        return Markup.inlineKeyboard(buttonLayout).extra()
    } else {
        return []
    }
}

const answerCallback = async (serviceID, text, alert = false, extra = {}) => {
    return new Telegraf(TelegramAPIKey)
        .telegram
        .answerCbQuery(serviceID, text, alert, extra)
}


module.exports = {
    sendMessage, sendPhoto, editMessage, deleteMessage, inlineKeyboard, answerCallback
}

