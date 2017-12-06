let mongoose = require('mongoose');

const { database, secret } = require('../config');
mongoose.Promise = global.Promise;
mongoose.connect(database,{ useMongoClient: true, /* other options */ });

module.exports = mongoose;
