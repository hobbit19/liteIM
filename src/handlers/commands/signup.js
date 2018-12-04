const functionHandler = require('../functions')
const validationHandler = require('../validation')

module.exports = async (commandData, serviceData) => {

    let response
    const languages = process.env.LANGUAGES.split(',')
    const steps = ['language', 'email', 'phone', 'code']
    let { command, params, conversationData } = commandData
    const { service, serviceID, message, options } = serviceData

    if (!conversationData) {

        await functionHandler.createConversation(service, serviceID, command)

        response = {
            response: {
                type: 'request',
                scope: 'signup',
                specification: 'language'
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
                if (languages.includes(message)) {
                    response = {
                        response: {
                            type: 'request',
                            scope: 'signup',
                            specification: 'email'
                        }
                    }
                } else {
                    isInvalidStep = true
                }

                break

            case 1:
                //email
                let email = message
                if (validationHandler.isEmail(email)) {
                    try {
                        let emailExists = await functionHandler.checkIfEmailExists(email)
                        if (!emailExists){
                            response = {
                                response: {
                                    type: 'request',
                                    scope: 'signup',
                                    specification: 'phone'
                                }
                            }
                        } else {
                            commandData.command = 'linkaccount'

                            await functionHandler.updateConversation(
                                service,
                                serviceID,
                                { email },
                                commandData.command
                            )
                            let user = await functionHandler.getUserByEmail(email)
                            let phone = await functionHandler.getPhoneNumberForUser(user.id)

                            await functionHandler.updateConversation(
                                service,
                                serviceID,
                                { email, phone },
                                commandData.command
                            )

                            await functionHandler.request2FA(user.id)

                            return {
                                response: {
                                    type: 'request',
                                    scope: 'linkAccount',
                                    specification: 'code',
                                    context: { identifier: 'email' }
                                }
                            }
                        }
                    } catch (response) {
                        return response
                    }
                } else {
                    isInvalidStep = true
                }

                break

            case 2:
                //phone
                let phone = message
                if (validationHandler.isPhoneNumber(phone)) {
                    try {
                        let number = (phone.charAt(0) === '+') ? phone.substr(1) : phone
                        let numberExists = await functionHandler.checkIfPhoneNumberExists(number)
                        if (!numberExists) {
                            await functionHandler.enable2FA(service, serviceID, number)
                            response = {
                                response: {
                                    type: 'request',
                                    scope: 'signup',
                                    specification: 'code',
                                    context: { number }
                                }
                            }
                        } else {
                            commandData.command = 'linkaccount'
                            let user = await functionHandler.getUserByPhone(phone)
                            let email = user.email

                            await functionHandler.updateConversation(
                                service,
                                serviceID,
                                { email, phone },
                                commandData.command
                            )

                            await functionHandler.request2FA(user.id)

                            return {
                                response: {
                                    type: 'request',
                                    scope: 'linkAccount',
                                    specification: 'code',
                                    context: { identifier: 'phone number' }
                                }
                            }
                        }
                    } catch (response) {
                        return response
                    }
                } else {
                    isInvalidStep = true
                }
                break

            case 3:
                //code
                let code = message
                if (validationHandler.isCode(code)) {
                    try {
                        await functionHandler.check2FA(service, serviceID, code)
                        response = {
                            response: {
                                type: 'request',
                                scope: 'signup',
                                specification: 'password'
                            }
                        }
                    } catch (response) {
                        return response
                    }
                } else {
                    isInvalidStep = true
                }
                break

            case 4: {
                //password
                let password = message
                let {language, email} = values
                try {

                    let addresses = await functionHandler.signup(service, serviceID, language, email, password)

                    await functionHandler.updateIdOn2FA(service, serviceID)
                    isComplete = true
                    response = {
                        response: {
                            type: 'success',
                            scope: 'signup',
                            specification: null,
                            context: {addresses}
                        }
                    }
                } catch (response) {
                    return response
                }
                break
            }
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