const fs = require('fs');
const sqlParser = require('@k-tavern/sql-parser');
const pluralize = require('pluralize');

function isDefaultLength(type, length) {
    // TODO:
    const map = {
        TINYINT: [3, 4],
        SMALLINT: [5, 6],
    };
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

function escapeValue(value) {
    const varType = typeof value;
    if (varType === 'string') {
        return value.replace("'", "\\'");
    }
    return value;
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
const sqlContent = fs.readFileSync('./sql.txt').toString('utf8');
try {
    const jsonScheme = sqlParser.parse(sqlContent);
    const models = [];
    if (jsonScheme && jsonScheme.length) {
        for (let tableScheme of jsonScheme) {
            if (tableScheme.type === 'create_table') {
                const tableName = tableScheme.name || '';
                const columns = tableScheme.columns || [];
                const options = tableScheme.options || [];
                if (tableName && columns.length) {
                    const model = {};
                    // 表名的命名规则为下划线命名法，且最后一个单词为复数形式，映射为 model 文件名则最后一个单词需要调整为单数形式
                    model.filename = pluralize.singular(tableName) + '.js';
                    model.tableName = tableName;
                    const fields = [];
                    const primaryKeys = [];
                    // const uniqueKeys = [];
                    // const indexKeys = [];

                    // Sequelize DataType
                    const sequelizeDataTypes = [];

                    for (let column of columns) {
                        if (column.type) {
                            switch (column.type) {
                                case 'column':
                                    fields.push(column);
                                    break;
                                case 'primary_key':
                                    primaryKeys.push(column);
                                    break;
                                // case 'unique_key':
                                //     uniqueKeys.push(column);
                                //     break;
                                // case 'index_key':
                                //     indexKeys.push(column);
                                //     break;
                            }
                        }
                    }
                    let primaryFields = [];
                    if (primaryKeys.length && primaryKeys[0].fields && primaryKeys[0].fields.length) {
                        primaryFields = primaryKeys[0].fields;
                    }
                    const fieldDefines = [];
                    for (let field of fields) {
                        if (field.name) {
                            const dataType = field.data_type;
                            let fieldType = getSequelizeDataType(dataType);
                            const bracketPos = fieldType.indexOf('(');
                            const dotPos = fieldType.indexOf('.');
                            const pos = bracketPos > 0 ? bracketPos : dotPos > 0 ? dotPos : -1;
                            sequelizeDataTypes.push(pos > 0 ? fieldType.substr(0, pos) : fieldType);

                            const fieldDefine = {
                                name: field.name,
                                type: fieldType,
                                dataType: dataType,
                            };
                            if (primaryFields.includes(field.name)) {
                                fieldDefine.primaryKey = true;
                            }
                            if (field.allow_null) {
                                fieldDefine.allowNull = field.allow_null;
                            }
                            if (field.auto_increment && field.auto_increment === true) {
                                fieldDefine.autoIncrement = true;
                            }
                            if (field.default_value !== undefined) {
                                if (typeof field.default_value === 'number') {
                                    fieldDefine.defaultValue = field.default_value;
                                } else {
                                    fieldDefine.defaultValue = `'${field.default_value.replace("'", "\\'")}'`;
                                }
                            }
                            if (field.comment) {
                                fieldDefine.comment = field.comment;
                            }
                            fieldDefines.push(fieldDefine);
                        }
                    }
                    model.columns = fieldDefines;
                    if (options.length) {
                        const modelOptions = [];
                        for (let optionItem of options) {
                            if (optionItem.key === 'COMMENT') {
                                modelOptions.push(optionItem);
                            }
                        }
                        if (modelOptions.length) {
                            model.options = modelOptions;
                        }
                    }

                    model.sequelizeDataTypes = Array.from(new Set(sequelizeDataTypes));
                    models.push(model);
                }
            }
        }
    }

    if (models.length) {
        // 生成 model 代码文件
        const modelPath = './model';
        const ident = '    '; // 缩进 4 个空格
        for (let model of models) {
            const filename = `${modelPath}/${model.filename}`;
            const sequelizeDataTypeString = `${model.sequelizeDataTypes.join(', ')}`;
            const tableName = model.tableName;
            let columnString = '';
            const modelProperties = [];
            if (model.columns) {
                // columnString = JSON.stringify(model.columns, null, ident) + ',';
                columnString = '{\n';

                for (let columnItem of model.columns) {
                    let columnItemString = ident.repeat(3) + `${columnItem.name}:{\n`;
                    if (columnItem.type) {
                        columnItemString += ident.repeat(4) + `type: ${columnItem.type},\n`;
                    }
                    if (columnItem.primaryKey) {
                        columnItemString += ident.repeat(4) + `primaryKey: true,\n`;
                    }
                    if (columnItem.autoIncrement) {
                        columnItemString += ident.repeat(4) + `autoIncrement: true,\n`;
                    }
                    if (!columnItem.allowNull) {
                        columnItemString += ident.repeat(4) + `allowNull: false,\n`;
                    }
                    if (columnItem.defaultValue !== undefined) {
                        columnItemString += ident.repeat(4) + `defaultValue: ${columnItem.defaultValue},\n`;
                    }
                    if (columnItem.comment) {
                        columnItemString += ident.repeat(4) + `comment: '${columnItem.comment.replace("'", "\\'")}',\n`;
                    }
                    columnItemString += ident.repeat(3) + '},\n';
                    columnString += columnItemString;

                    // model property
                    modelProperties.push({
                        type: getJsType(columnItem.dataType.type || null),
                        name: columnItem.name,
                        comment: columnItem.comment || '',
                    });
                }

                columnString += ident.repeat(2) + '},';
            }
            let optionString = '';
            if (columnString && model.options) {
                optionString += '{\n';
                for (let optionItem of model.options) {
                    if (optionItem.key === 'COMMENT') {
                        optionString += `${ident.repeat(3)}comment: '${optionItem.value.replace("'", "\\'")}',\n`;
                    }
                }
                optionString += ident.repeat(2) + '},';
            }
            const modelPropertyStringArr = modelProperties.map(item => {
                let result = ` * @property { ${item.type} } ${item.name}`;
                if (item.comment) {
                    result += ' ' + item.comment;
                }
                return result;
            });
            const content = `
/**
 * @param { Egg.Application } app egg app
 */
module.exports = function(app) {
    const { ${sequelizeDataTypeString} } = app.Sequelize;
    const { model } = app;
    return model.define(
        '${tableName.replace("'", "\\'")}',
        ${columnString}
        ${optionString}
    );
};

/**
 * @typedef { Object } ${tableName.toUpperCase()}_TYPE
${modelPropertyStringArr.join('\n')}
 */
`;
            fs.writeFileSync(filename, content);
        }
    }
} catch (err) {
    console.log('[ sql parse error ] ', err);
}
