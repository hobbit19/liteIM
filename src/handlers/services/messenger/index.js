const functionHandler = require('../../functions')

const options = {
    menuSupport: true,
    htmlSupport: false,
    transactionLimit: 1
}

const initialize = (data, service) => {

    let serviceData = { options }
    let webhookData = data.body

    let messaging_events = webhookData.entry[0].messaging
    let event = messaging_events[0]
    let serviceID = event.sender.id

    let message
    if (event.postback) {
        message = event.postback.payload
    }
    else if (event.message.quick_reply) {
        message = event.message.quick_reply.payload
    }
    else {
        message = event.message.text
    }

    serviceData.service = service
    serviceData.serviceID = serviceID
    serviceData.message = message.trim()

    return serviceData

}

const prepareResponse = async (message, menu, serviceData, responseData) => {
    const { service, serviceID } = serviceData
    const { image } = responseData

    menu = formatMenu(menu)

    return {
        service,
        serviceID,
        message,
        menu,
        image
    }
}

const send = async (responsePayload) => {
    const { service, serviceID, message, menu, image } = responsePayload

    let messageData = { text: message }
    if (menu && menu.length > 3) messageData.quick_replies = menu
    else {
        messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "button",
                    "text": message,
                    "buttons": menu
                }
            }
        }
    }

    if (image) {
        messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": [
                        {
                            "title": image.title,
                            "image_url": image.url,
                            "subtitle": image.caption,
                            "default_action": {
                                "type": "web_url",
                                "url": image.url,
                                "webview_height_ratio": "full",
                            },
                            "buttons": [{
                                "type": "postback",
                                "title": menu[0].title,
                                "payload": menu[0].payload
                            }]
                        }
                    ]
                }
            }
        }
    }

    let token = (process.env.STAGE === 'production')
        ? process.env.FACEBOOK_MESSENGER_PROD_TOKEN
        : process.env.FACEBOOK_MESSENGER_DEV_TOKEN

    const request = require('request')
    return request(
        {
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {
                access_token: token
            },
            method: 'POST',
            json: {
                recipient: { id: serviceID },
                message: messageData
            }
        },
        (error, response, body) => {
            if (error) {
                console.log('Sending error:', error)
            }
        }
    )
}

const formatMenu = (menu) => {
    let buttons = []
    if (menu.length > 3){
        menu.forEach(button => {
            buttons.push({
                content_type: 'text',
                title: button.text,
                payload: button.callback_data
            })
        })
    } else {
        menu.forEach(button => {
            if (button.type === 'securePassword') {
                buttons.push({
                    type: 'web_url',
                    url: button.url,
                    title: button.text,
                    webview_height_ratio: 'full'
                })
            }
            else if (button.url) {
                buttons.push({
                    type: 'web_url',
                    url: button.url,
                    title: button.text,
                    webview_height_ratio: 'full'
                })
            }
            else {
                buttons.push({
                    type: 'postback',
                    title: button.text,
                    payload: button.callback_data
                })
            }
        })
    }

    return buttons
}

module.exports = {
    options, initialize, prepareResponse, send
}