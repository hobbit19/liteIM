module.exports = async (commandData, serviceData) => {

    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (user) {
        return {
            response: {
                type: 'success',
                scope: 'start',
                specification: 'welcomeBack'
            }
        }
    } else {
        return {
            response: {
                type: 'success',
                scope: 'start',
                specification: 'welcome'
            }
        }
    }
}