const functionHandler = require('../../functions')

const options = {
    menuSupport: true,
    htmlSupport: false,
    menuSize: 4,
    transactionLimit: 2,
    defaultLanguage: 'vi'
}

const initialize = (data, service) => {
    let serviceData = { options }
    let webhookData = data.body

    let serviceID = webhookData.sender.id
    let message = webhookData.message.text

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
    if (menu) {
        let defaultAction
        let imageURL = 'https://www.lite.im/static/icons/Icon-1024.png'
        if (image) {
            imageURL = image.url
            defaultAction = {
                type: 'oa.open.url',
                url: image.url
            }
        } else {
            defaultAction = {
                "type": "oa.query.hide",
                "payload": ' '
            }
        }

        let elements = menu
        elements.unshift({
            "title": "Lite.IM",
            "subtitle": message,
            "image_url": imageURL,
            "default_action": defaultAction
        })

        messageData = {
            "attachment": {
                "type": "template",
                "payload": {
                    "template_type": "list",
                    "elements": elements
                }
            }
        }
    }

    const request = require('request')
    return request(
        {
            url: 'https://openapi.zalo.me/v2.0/oa/message',
            qs: {
                access_token:
                process.env.ZALO_ACCESS_TOKEN
            },
            method: 'POST',
            json: {
                recipient: { user_id: serviceID },
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
    menu.forEach(button => {
        if (button.type === 'securePassword') {
            buttons.push({
                title: button.text,
                subtitle: button.text,
                image_url: 'https://www.lite.im/static/icons/Icon-1024.png',
                default_action: {
                    type: 'oa.open.url',
                    url: button.url
                }
            })
        }
        else if (button.url) {
            buttons.push({
                title: button.text,
                subtitle: button.text,
                image_url: 'https://www.lite.im/static/icons/Icon-1024.png',
                default_action: {
                    type: 'oa.open.url',
                    url: button.url
                }
            })
        }
        else {
            buttons.push({
                title: button.text,
                subtitle: button.text,
                image_url: 'https://www.lite.im/static/icons/Icon-1024.png',
                default_action: {
                    type: 'oa.query.hide',
                    payload: button.callback_data
                }
            })
        }
    })

    return buttons
}

module.exports = {
    options, initialize, prepareResponse, send
}