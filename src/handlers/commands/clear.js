const functionHandler = require('../functions')

module.exports = async (commandData, serviceData) => {

    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    await functionHandler.clearConversation(service, serviceID)

    return {
        response: {
            type: 'success',
            scope: 'clear',
            specification: null
        }
    }

}