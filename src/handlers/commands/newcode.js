const functionHandler = require('../functions')

module.exports = async (commandData, serviceData) => {

    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (user) {
        await functionHandler.request2FA(user.id)
    } else {

        let user, phone
        if (conversationData.values.phone) {
            phone = conversationData.values.phone
        }
        else if (conversationData.values.email) {
            user = await functionHandler.getUserByEmail(conversationData.values.email)
            phone = await functionHandler.getPhoneNumberForUser(user.id)
        }

        if (command === 'linkacount') {
            if (!user) {
                user = await functionHandler.getUserByPhone(phone)
            }

            await functionHandler.request2FA(user.id)

        } else {
            await functionHandler.enable2FA(service, serviceID, phone)
        }
    }

    return {
        response: {
            type: 'request',
            scope: 'code'
        }
    }
}