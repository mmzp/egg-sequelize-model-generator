function isDefaultLength(type, length) {
    // TODO:
    const map = {
        TINYINT: [3, 4],
        SMALLINT: [5, 6],
    };
}

function escapeValue(value) {
    const varType = typeof value;
    if (varType === 'string') {
        return value.replace("'", "\\'");
    }
    return value;
}


function getJsType(fieldType) {
    let jsType;
    switch (fieldType) {
        case 'TINYINT':
        case 'SMALLINT':
        case 'MEDIUMINT':
        case 'INT':
        case 'BIGINT':
        case 'DECIMAL':
        case 'FLOAT':
        case 'DOUBLE':
        case 'YEAR':
            jsType = 'number';
            break;
        default:
            jsType = 'string';
            break;
    }
    return jsType;
}

function getSequelizeDataType(dataType) {
    const type = dataType.type || '';
    if (!type) {
        throw new Error('dataType.type is empty');
    }
    const params = dataType.params || [];
    const unsigned = dataType.unsigned && dataType.unsigned === true;
    const zerofill = dataType.zerofill && dataType.zerofill === true;
    let result = '';
    let _type;
    switch (type) {
        case 'TINYINT':
        case 'SMALLINT':
        case 'MEDIUMINT':
        case 'INT':
        case 'BIGINT':
            _type = type;
            if (type === 'INT') {
                _type = 'INTEGER';
            }
            if (params.length) {
                result = `${_type}(${params[0]})`;
            } else {
                result = _type;
            }
            if (unsigned) {
                result += '.UNSIGNED';
            }
            if (zerofill) {
                result += '.ZEROFILL';
            }
            break;

        case 'DECIMAL':
        case 'FLOAT':
        case 'DOUBLE':
        case 'BIT':
            if (!params.length) {
                result = type;
            } else {
                result = `${type}(${params.join(',')})`;
            }
            break;

        case 'DATE':
        case 'DATETIME':
        case 'TIMESTAMP':
        case 'TIME':
        case 'YEAR':
            _type = type;
            if (type === 'DATE') {
                _type = 'DATEONLY';
            } else if (type === 'DATETIME') {
                _type = 'DATE';
            } else if (type === 'TIMESTAMP') {
                // 不支持的类型
                _type = 'DATE';
            } else if (type === 'YEAR') {
                // 不支持的类型
                _type = 'SMALLINT';
            }
            if (params.length) {
                result = `${_type}(${params[0]})`;
            } else {
                result = _type;
            }
            break;

        case 'CHAR':
        case 'VARCHAR':
        case 'BINARY':
        case 'VARBINARY':
        case 'TINYBLOB':
        case 'BLOB':
        case 'MEDIUMBLOB':
        case 'LONGBLOB':
        case 'TINYTEXT':
        case 'TEXT':
        case 'MEDIUMTEXT':
        case 'LONGTEXT':
            _type = type;
            let isBinary = false;
            let length = '';
            if (type === 'VARCHAR') {
                _type = 'STRING';
            } else if (type === 'BINARY') {
                _type = 'CHAR';
                isBinary = true;
            } else if (type === 'VARBINARY') {
                _type = 'STRING';
                isBinary = true;
            } else if (type === 'TINYBLOB') {
                _type = 'BLOB';
                length = 'tiny';
            } else if (type === 'MEDIUMBLOB') {
                _type = 'BLOB';
                length = 'medium';
            } else if (type === 'LONGBLOB') {
                _type = 'BLOB';
                length = 'long';
            } else if (type === 'TINYTEXT') {
                _type = 'TEXT';
                length = 'tiny';
            } else if (type === 'MEDIUMTEXT') {
                _type = 'TEXT';
                length = 'medium';
            } else if (type === 'LONGTEXT') {
                _type = 'TEXT';
                length = 'long';
            }
            if (length) {
                result = `${_type}('${length}')`;
            } else if (params.length) {
                result = `${_type}(${params[0]})`;
            } else {
                result = _type;
            }
            if (isBinary) {
                result += '.BINARY';
            }
            break;

        case 'JSON':
            result = type;
            break;

        case 'ENUM':
            if (!params.length) {
                throw new Error('data type ENUM must be define values');
            }
            const paramArr = [];
            for (let paramItem of params) {
                paramArr.push(escapeValue(paramItem));
            }
            result = `ENUM(${paramArr.join(',')})`;
            break;

        case 'SET':
            throw new Error('data type SET is not supported');
            break;

        case 'GEOMETRY':
            result = type;
            break;

        case 'POINT':
        case 'LINESTRING':
        case 'POLYGON':
        case 'MULTIPOINT':
        case 'MULTILINESTRING':
        case 'MULTIPOLYGON':
        case 'GEOMETRYCOLLECTION':
            result = `GEOMETRY('${type}')`;
            break;

        default:
            throw new Error(`data type ${type} is not supported`);
            break;
    }
    return result;
}

module.exports = {
    getJsType,
    getSequelizeDataType,
};
