const functionHandler = require('../../functions')

const options = {
    menuSupport: false,
    htmlSupport: false,
    transactionLimit: 1
}

const initialize = async (data, service) => {

    let serviceData = { options }
    let webhookData = data.body
    let { Body, From } = webhookData

    let serviceID = From

    //check if sender is from one of our supported countries
    const { parseNumber } = require('libphonenumber-js')
    let parsed = parseNumber(serviceID)
    if (parsed.country !== 'US' && parsed.country !== 'CA' && parsed.country !== 'CH') {
        return false
    }

    serviceData.service = service
    serviceData.serviceID = serviceID
    serviceData.message = Body.trim()

    return serviceData

}

const prepareResponse = async (message, menu, serviceData, responseData) => {
    const { service, serviceID } = serviceData
    const { image } = responseData

    if (image) {
        message = image.url + message
    }

    return {
        service,
        serviceID,
        message
    }
}

const send = async (responsePayload) => {

    const { service, serviceID, message } = responsePayload

    const client = require('twilio')(
        process.env.TWILIO_LITEIM_ACCOUNT_SID,
        process.env.TWILIO_LITEIM_AUTH_TOKEN
    )

    return client.messages.create({
        body: message,
        to: serviceID,
        messagingServiceSid: process.env.TWILIO_LITEIM_SERVICE_ID
    })
}

module.exports = {
    options, initialize, prepareResponse, send
}