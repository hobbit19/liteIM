const functionHandler = require('./functions')

module.exports = async (message) => {
    try {
        let allUsersSnapshot = await functionHandler.getAllUsersSnapshot()
        allUsersSnapshot.forEach(async doc => {
            if (doc && doc.exists) {
                let user = doc.data()
                user.id = doc.id
                let services = user.services
                for (let service in services) {
                    if (services.hasOwnProperty(service)){
                        const serviceHandler = require(`./services/${service}`)
                        let serviceID = services[service]
                        let options = serviceHandler.options

                        const serviceData = { service, serviceID, message, options }
                        const commandData = { command: 'broadcast', user }
                        const responseData = { response: { type: 'success' } }
                        const responseMessage = { message }
                        let { menu } = require('./menus')(serviceData, commandData, responseData, responseMessage)

                        if (!options.menuSupport) {
                            let content = ''
                            if (menu && menu.length > 0) {
                                content += '\n\n'
                                for (let i = 0; i < menu.length; i++) {
                                    let item = menu[i]
                                    content += `${i}: ${item.text} ${i === menu.length - 1 ? '' : '\n'}`
                                }

                                await functionHandler.setLastMenu(service, serviceID, menu)
                                message = message + '\n\n' + content
                            }

                            menu = false

                        }

                        const payload = await serviceHandler.prepareResponse(message, menu, serviceData, responseData)

                        await serviceHandler.send(payload)
                    }
                }
            }
        })
    } catch (e) {
        console.log(e)
    }
}