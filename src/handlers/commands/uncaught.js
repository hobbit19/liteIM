module.exports = async (commandData, serviceData) => {
    return {
        response: {
            type: 'failure',
            scope: 'unknownInput',
            specification: null
        }
    }
}