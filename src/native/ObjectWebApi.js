const ObjectWebApi = Object.freeze({
    $Log: Object.freeze({
        __log__(logType, backgroundColor, textColor, data) {
            console.log(
                `%c[${logType}]%c${typeof data === 'string' ? data : ''}`,
                'background-color:azure;color:black;',
                `background-color:${backgroundColor};color:${textColor};`,
                ...data
            );
        },
        print(...data) {
            console.log(...data)
        },
        info(...data) {
            this.__log__('INFO', '#2c93fe', 'white', data);
        },
        warn(...data) {
            this.__log__('WARN', '#fe8d2c', 'white', data);
        },
        err(...data) {
            this.__log__('ERR', '#f32f0c', 'white', data);
        }
    }),

    $Enum(...values) {
        return Object.freeze({
            values: values,
            is(value) {
                return value ? this.values.includes(value) : false
            }
        })
    },
    $Object: null,
    $Class: null,
    $Static: null,
    $Match: null
});