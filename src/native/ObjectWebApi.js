const _o = Object.freeze({
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
                return value ? this.values.includes(value) : false;
            }
        });
    },

    $DataPointer: Symbol.for('data_pointer'),

    $Type(type) {
        // Name of the type
        let name = type.$name ?? '<anonymous>'

        // Constructor for type
        let ctor = type.ctor ?? ({ handler: () => {} });

        // Native methods
        let nativeMethods = [
            'ctor', '_get_', '_set_'
        ];
        let nativeBaseMethods = [
            'valueOf', 'toString'
        ];

        // Fields & Methods
        let fields = {},
            methods = {};

        Object.keys(type).forEach(typeMemberName => {
            let typeMember = type[typeMemberName];

            // Field (has getter, setter)
            if(typeMember.get && typeMember.set)
                fields[typeMemberName] = typeMember;
            // Method (has handler)
            else if(typeMember.handler)
                methods[typeMemberName] = typeMember;
        });

        return (...args) => {
            const baseDataObject = {
                ...fields,
                ...methods 
            };

            // Base object for private manipulations
            const baseObject = {
                [_o.$DataPointer]: {
                    type: name
                }
            };
            Object.keys(baseDataObject).forEach(memberName => {
                let memberData = baseDataObject[memberName];

                // Field
                if(memberData.get && memberData.set)
                    baseObject[memberName] = memberData.initial ?? null;
                // Method
                if(memberData.handler && !nativeMethods.includes(memberName))
                    baseObject[memberName] = memberData.handler;
            });

            const createProxy = (data, obj, privateObj, settings) => {
                return new Proxy(obj, {
                    ownKeys(target) {
                        let publicMembers = Object.keys(obj)

                        // Walk members to delete the private/native ones
                        publicMembers.forEach(memberName => {
                            let { get } = data[memberName]

                            // Is native method?
                            if(settings.keys !== 'any' && nativeMethods.includes(memberName))
                                delete publicMembers[memberName]
                            // Is private getter
                            if(settings.keys !== 'any' && get !== 'public')
                                delete publicMembers[memberName]
                        })

                        return publicMembers
                    },
                    get(target, prop) {
                        // Is symbol
                        if(typeof prop === 'symbol')
                            return obj[prop]
                        // Is base native thing
                        if(nativeBaseMethods.includes(prop))
                            return obj[prop]

                        let { get } = data[prop]

                        // Check that field is not native
                        if(nativeMethods.includes(prop)) {
                            _o.$Log.err(`Failed to get native field/method '${prop}'`)
                            return undefined
                        }

                        // Check that field is defined
                        if(obj[prop] === undefined) {
                            _o.$Log.err(`Failed to get field/method '${prop}' (field is not defined)`)
                            return undefined
                        }

                        // Is method
                        if(data[prop].handler) {
                            if(data[prop].private === true)
                                _o.$Log.err(`Failed to get private method '${prop}' (private methods is accesible only inside type)`)
                            else
                                return data[prop].handler.bind(privateObj ?? target)
                        }

                        // Check that prop getter is public
                        if(get !== 'public' && settings.get !== 'any') {
                            _o.$Log.err(`Failed to get private field '${prop}' (private fields is accesible only inside type)`)
                            return undefined
                        }

                        // Check that natively is allowed
                        if(!(data._get_ ? data._get_.handler.bind(obj)(prop) : true)) {
                            _o.$Log.err(`Failed to get field '${prop}' (prohibited by type)`)
                            return undefined
                        }
                        
                        return obj[prop]
                    },
                    set(target, prop, value) {
                        let { set, typecheck } = data[prop]

                        // Check that prop is exists
                        if(obj[prop] === undefined) {
                            _o.$Log.err(`Failed to define field '${prop}' (unable to define new members of type)`)
                            return false
                        }

                        // Check that prop getter is public
                        if(set !== 'public' && settings.set !== 'any') {
                            _o.$Log.err(`Failed to change value of private field '${prop}' (private fields is accesible only inside type)`)
                            return false
                        }

                        // Check that natively is allowed
                        if(!(data._set_ ? data._set_.handler.bind(obj)(prop, value) : true)) {
                            _o.$Log.err(`Failed to change value of field '${prop}' (prohibited by type)`)
                            return false
                        }

                        // Check that types doesn't mismatch
                        if(typecheck && typecheck.bind(privateObj ?? target)(value) !== true) {
                            _o.$Log.err(`Failed to change value of field '${prop}' to value '${value}' of ${typeof value} type (value was invalid)`)
                            return false
                        }
                        
                        obj[prop] = value
                        return true
                    },
                    deleteProperty(target, prop) {
                        return false
                    }
                });
            };

            // Base object for private manipulations
            const basePrivateObject = createProxy(baseDataObject, baseObject, null, {
                keys: 'private',
                set: 'any',
                get: 'any'
            });

            // Base object for public manipulations
            const basePublicObject = createProxy(baseDataObject, baseObject, basePrivateObject, {
                keys: 'public',
                set: 'public',
                get: 'public'
            });

            // Call the constructor for base object
            ctor.handler.bind(basePrivateObject)(...args)

            return basePublicObject
        };
    },

    $Prototype: null,

    $Static: null,

    $Match(value, options) {
        let result = undefined
        for(let optionKey in options) {
            // Full match with string key
            if(optionKey === value) {
                result = options[optionKey]
                return
            }
            // Regex match
            else if(optionKey.includes('/') && new RegExp(optionKey)) {
                result = options[optionKey]
                return
            }
        }
        return result ?? options._
    },

    $Pipeline(...params) {
        return params.reduce((prev, cur) => cur(prev) || prev)
    }
});