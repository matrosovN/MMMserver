module.exports = function (logger) {
    var mongoose  = require('mongoose');
    var Schema    = mongoose.Schema;
    var User      = mongoose.model('User');
    var JSONError = require('../lib/json_error');
    var SHA256    = require('crypto-js/sha256');

    var CompanySchema = new Schema({
        name: String,
        INN: String,
        OGRN: String,
        parentCompany: String,
        region: String,
        email: String,
        address: String,
        logo: String,
        type: String,
        subscribers: [Schema.Types.Object],
        active: Boolean,
        activationHash: String
    });

    CompanySchema.methods.toJSON = function () {
        var company =  {
            id: this._id,
            name: this.name,
            INN: this.INN,
            OGRN: this.OGRN,
            parentCompany: this.parentCompany,
            region: this.region,
            address: this.address,
            logo: this.logo
        };

        return company;
    };

    CompanySchema.methods.addLogo = function(filename){
        if (!filename) {
            return;
        }
        this.logo = '/companies/' + filename;
    };

    CompanySchema.methods.generateActivationHash = function() {
        logger.info('Генерирую хэш для активации..');
        return SHA256(this.name + this.login + new Date().toDateString()).toString();
    };

    CompanySchema.methods.setActivationHash = function(hash) {
        this.active = false;
        this.activationHash = hash;
        logger.info('Установил компании ' + this._id + ' хэш для активации (' + hash + ')');
        this.save();
    };

    CompanySchema.methods.activate = function() {
        this.activationHash = null;
        this.active = true;
        logger.info('Компания с id ' + this._id + ' активировала е-майл')
        this.save();
    };

    CompanySchema.methods.addSubscriber = function (id, callback) {
        if (this.subscribers.indexOf(id) != -1) {
            return callback(new JSONError('error', 'Этот пользователь уже есть в подписчиках'));
        }

        this.subscribers.push(id);
        logger.info('Добавляю пользователя ' + id.toString() + ' к подписчикам компании ' + this._id.toString());
        this.save();
        callback(null);
    };

    CompanySchema.methods.removeSubscriber = function (id, callback) {
        var userPosition = this.subscribers.indexOf(id);
        if (userPosition == -1) {
            return callback(new JSONError('error', 'Этого пользователя нет в подписчиках'));
        }

        this.subscribers.splice(userPosition, 1);
        logger.info('Удаляю пользователя ' + id.toString() + ' из подписчиков компании ' + this._id.toString());
        this.save();
        callback(null);
    };

    CompanySchema.statics.tryActivateByHash = function(hash, callback) {
        this.findOne({'activationHash': hash}, (err, company) => {
            if (err) {
                callback(err);
                return;
            }

            if (!company){
                callback(new Error('Нет такой компании или уже активирована'));
                return;
            }

            company.activate();
            callback(null, company);
        });
    };

    User.discriminator('Company', CompanySchema);
    logger.info('Подключил модель Company');
};
