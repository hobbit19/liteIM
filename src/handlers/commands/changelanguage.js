const functionHandler = require('../functions')

module.exports = async (commandData, serviceData) => {

    let response
    const languages = process.env.LANGUAGES.split(',')
    const steps = ['language']
    const { command, params, conversationData, user } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'changeLanguage'
            }
        }

    } else {

        let { values } = conversationData
        if (!values) { values = {} }
        let step = Object.keys(values).length
        let isInvalidStep = false
        let isComplete = false

        switch (step) {
            case 0:
                //language
                let language = message
                if (languages.includes(language)) {

                    try {
                        await functionHandler.changeLanguage(user, language)

                        user.language = language

                        response = {
                            response: {
                                type: 'success',
                                scope: 'changeLanguage',
                                specification: null,
                                context: { language }
                            }
                        }
                    } catch (response) {
                        return response
                    }

                } else {
                    isInvalidStep = true
                }

                break
        }

        if (isInvalidStep) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'conversation',
                    specification: 'invalidStep',
                    context: { step: steps[step] }
                }
            }
        } else {
            if (isComplete) {
                await functionHandler.clearConversation(service, serviceID)
            } else {
                await functionHandler.updateConversation(service, serviceID, { [steps[step]]: message })
            }
        }

        if (!response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'conversation',
                    specification: 'unexpectedInput'
                }
            }
        }
    }

    return response

}