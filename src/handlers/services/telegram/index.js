const functionHandler = require('../../functions')

const options = {
    menuSupport: true,
    htmlSupport: true
}

const initialize = (data, service) => {
    let serviceData = { options }
    let webhookData = data.body

    let serviceID, callbackMessageID, messageContent
    if (webhookData.message && webhookData.message.text) {
        serviceID = webhookData.message.from.id
        messageContent = webhookData.message.text
    } else if (webhookData.callback_query) {
        serviceID = webhookData.callback_query.from.id
        callbackMessageID = webhookData.callback_query.message.message_id
        messageContent = webhookData.callback_query.data
    } else {
        return false
    }

    serviceData.service = service
    serviceData.serviceID = serviceID
    serviceData.message = messageContent.trim()
    serviceData.callbackMessageID = callbackMessageID

    return serviceData
}

const prepareResponse = async (message, menu, serviceData, responseData) => {
    const { service, serviceID, callbackMessageID } = serviceData
    const { image } = responseData

    menu = formatMenu(menu)

    return {
        service,
        serviceID,
        message,
        menu,
        callbackMessageID,
        image
    }
}

const send = async (responsePayload) => {
    const { service, serviceID, message, menu, callbackMessageID, image } = responsePayload
    let bot = require('./api')

    if (image) {
        let messageIdToDelete = await functionHandler.getBotMessageID(service, serviceID)
        if (messageIdToDelete.messageID)
            await bot.deleteMessage(serviceID, messageIdToDelete.messageID)

        await bot.sendPhoto(
            serviceID,
            image.url,
            image.caption,
            bot.inlineKeyboard(menu)
        )
    } else {
        if (callbackMessageID) {
            try {
                await bot.editMessage(
                    serviceID,
                    callbackMessageID,
                    message,
                    bot.inlineKeyboard(menu)
                )
            } catch (err) {
                //if we can't edit the message, then delete the last one and send a new one
                console.log(`Failed to edit message with error: ${err}`)
                let messageIdToDelete = await functionHandler.getBotMessageID(service, serviceID)
                if (messageIdToDelete.messageID)
                    await bot.deleteMessage(serviceID, messageIdToDelete.messageID)
                await bot.sendMessage(
                    serviceID,
                    message,
                    bot.inlineKeyboard(menu)
                )
            }
        } else {
            try {
                let messageIdToDelete = await functionHandler.getBotMessageID(service, serviceID)
                if (messageIdToDelete.messageID)
                    await bot.deleteMessage(serviceID, messageIdToDelete.messageID)
            } catch (err) {
                console.log(`Could not delete prior message. Error: ${err}`)
            }
            await bot.sendMessage(serviceID, message, bot.inlineKeyboard(menu))
        }
    }
}

const formatMenu = (menu) => {
    if (menu.length === 5) {
        if ((menu[0] && menu[0].text.length > 17) ||
            (menu[1] && menu[1].text.length > 17) ||
            (menu[2] && menu[2].text.length > 17) ||
            (menu[3] && menu[3].text.length > 17) ||
            (menu[4] && menu[4].text.length > 17))
        {
            let tmpMenu = []
            menu.forEach(button => {
                tmpMenu.push([button])
            })
            menu = tmpMenu
        } else {
            menu = [[menu[0], menu[1]], [menu[2], menu[3]], [menu[4]]]
        }
    }
    else if (menu.length === 4) {
        if ((menu[0] && menu[0].text.length > 17) ||
            (menu[1] && menu[1].text.length > 17) ||
            (menu[2] && menu[2].text.length > 17) ||
            (menu[3] && menu[3].text.length > 17)) {

            menu = [[menu[0], menu[1]], [menu[2], menu[3]]]

        } else {
            menu = [[menu[0], menu[1], menu[2]], [menu[3]]]
        }
    } else {
        if ((menu[0] && menu[0].text.length > 15) ||
            (menu[1] && menu[1].text.length > 15) ||
            (menu[2] && menu[2].text.length > 15))
        {
            let tmpMenu = []
            menu.forEach(button => {
                tmpMenu.push([button])
            })
            menu = tmpMenu
        }
    }

    return menu
}

module.exports = {
    options, initialize, prepareResponse, send
}