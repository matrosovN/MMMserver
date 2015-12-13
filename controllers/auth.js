var express = require('express');
var router  = express.Router();
var mongoose = require('mongoose');
var checkLoginAndPassword = require('../utils/middlewares').checkLoginAndPassword;
var multer = require('multer'); // миддлвеар для загрузки файлов
var companyLogo = multer({dest: 'public/companies'});

router.post('/register/user', checkLoginAndPassword, (req, res) => {
    var User = mongoose.model('User');
    var user = new User(req.body);

    user.save((err, user) => {
        if (err) throw err;
        req.logger.info('Создал нового пользователя ' + user.login);
        res.end(req.msgGenerator.generateJSON('register', user.getToken()));
        req.logger.info('Отправил клиенту токен нового пользователя');
    });

});

router.post('/register/company', companyLogo('logo'), checkLoginAndPassword, (req, res) => {
    var pathToLogo = req.file.path;

    var Company = mongoose.model('Company');

    Company.create({
        login: req.body.login,
        password: req.body.login,
        logo: req.body.login,
    }, (err, company) => {
        if (err) throw err;

        req.logger.info('Создал новую компанию ' + company.login);
        res.end(req.msgGenerator.generateJSON('register', company.getToken()));
        req.logger.info('Отправил клиенту токен новой компании');
    });
});

router.post('/authorize', (req, res) => {
    var User = null;
    var token = null;

    if (!req.body.type) {
        req.logger.warn('В запросе авторизации не указан тип. Считаю, что это компания');
    }

    if (req.body.type == 'user') {
        User = mongoose.model('User');
    } else {
        User = mongoose.model('Company');
    }

    User.findOne({login: req.body.login}, function(err, user){
        if (err) throw err;
        if (!user) {
            req.logger.warn('Не найден юзер с логином ' + req.body.login);
            res.end(req.msgGenerator.generateJSON('error', 'Не найден юзер'));
            return;
        }

        if (user.checkPassword(req.body.password)){
            token = user.getToken();
            req.logger.info('Авторизовался пользователь ' + req.body.login);
            res.end(req.msgGenerator.generateJSON('token', token));
        } else {
            req.logger.warn('Попытка авторизации с неправильным паролем пользователя ' + req.body.login);
            res.end(req.msgGenerator.generateJSON('error', 'Неправильный пароль'));
        }

    });
});

module.exports = router;
