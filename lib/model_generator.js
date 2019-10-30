const fs = require('fs');
const sqlParser = require('@k-tavern/sql-parser');
const pluralize = require('pluralize');
const utils = require('./utils');

module.exports = {
    generate(sqlContent) {
        let jsonScheme = sqlParser.parse(sqlContent);
        let models = [];
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
                                let fieldType = utils.getSequelizeDataType(dataType);
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
                            columnItemString +=
                                ident.repeat(4) + `comment: '${columnItem.comment.replace("'", "\\'")}',\n`;
                        }
                        columnItemString += ident.repeat(3) + '},\n';
                        columnString += columnItemString;

                        // model property
                        modelProperties.push({
                            type: utils.getJsType(columnItem.dataType.type || null),
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
                console.log(`${filename} generated.`);
            }
        }
    },
};
