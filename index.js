const fs = require('fs');
const modelGenerator = require('./lib/model_generator');

const sqlContent = fs.readFileSync('./sql.txt').toString('utf8');
const sqlContentArr = sqlContent.split('\n\n');
for (let content of sqlContentArr) {
    modelGenerator.generate(content);
}
