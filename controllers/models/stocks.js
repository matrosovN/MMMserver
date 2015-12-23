var express   = require('express');
var mongoose  = require('mongoose');
var mw        = require('../../utils/middlewares.js');
var ObjectID  = require('mongodb').ObjectID;
var Stock     = mongoose.model('Stock');
var router    = express.Router();



router.post('/create', mw.requireCompanyAuth, (req, res) => {
    if (!req.file) {
        req.logger.warn('Запрос создания акции без логотипа');
    }

    var stock = new Stock({
        name: req.body.name,
        description: req.body.description,
        company: req.company._id,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate)
    });

    stock.addLogo(req.file);

    stock.save((err, stock) => {
        if (req.msgGenerator.generateError(err, req, res)) {
            return;
        }

        res.end(req.msgGenerator.generateJSON('stock', {id: stock._id, logo: stock.logo}));
    });
});

router.post('/edit', mw.requireCompanyAuth, (req, res) => {
    if (!req.file) {
        req.logger.warn('Запрос редактирования акции без логотипа');
    }

    Stock.findOne({'_id' : new ObjectID(req.body.id)}, (err, stock) => {
        if (req.msgGenerator.generateError(err, req, res)) {
            return;
        }

        if (!stock) {
            res.end(req.msgGenerator.generateJSON('error', 'Нет такой акции'));
            req.logger.warn('Нет акции с айди ' + req.body.id);
            return;
        }

        if (!stock.checkOwner(req.company._id)) {
            req.logger.warn('Компания с айди ' + req.company._id + ' не может редактировать акцию ' + req.body.id);
            res.end(req.msgGenerator.generateJSON('error', 'Вы не можете редактировать эту акцию'));
            return;
        }

        if (!req.file) {
            stock.name = req.body.name;
            stock.description = req.body.description;
            stock.endDate = new Date(req.body.endDate);

            stock.save((err) => {
                if (req.msgGenerator.generateError(err, req, res)) {return;}
                res.end(req.msgGenerator.generateJSON('stock', stock.logo));
            });
        } else {
            stock.removeImages((err) => {
                if (req.msgGenerator.generateError(err, req, res)) {return;}

                stock.addLogo(req.file);

                stock.name = req.body.name;
                stock.description = req.body.description;
                stock.startDate = new Date(req.body.startDate);
                stock.endDate = new Date(req.body.endDate);

                stock.save((err) => {
                    if (req.msgGenerator.generateError(err, req, res)) {return;}
                    res.end(req.msgGenerator.generateJSON('stock', stock.logo));
                });
            });
        }
    });
});

router.post('/remove', mw.requireCompanyAuth, (req, res) => {
    Stock.findOne({_id: req.body.id}, (err, stock) => {
        if (req.msgGenerator.generateError(err, req, res)) {
            return;
        }

        if (!stock) {
            res.end(req.msgGenerator.generateJSON('error', 'Нет такой акции!'));
            return;
        }

        if (!stock.checkOwner(req.company._id.toString())) {
            res.end(req.msgGenerator.generateJSON('error', 'Эта компания не имеет прав для удаления этой акции'));
            return;
        }

        stock.prepareRemove((err) => {
            if (req.msgGenerator.generateError(err, req, res)) {
                return;
            }

            res.end(req.msgGenerator.generateJSON('stock', stock._id));
            req.logger.info('Акция с айди ' + stock._id + ' удалена');
            stock.remove();
        });
    });
});

router.post('/subscribe', mw.requireClientAuth, (req, res) => {
    req.client.subscribe(req.body.id, (err, stock) => {
        if (req.msgGenerator.generateError(err, req, res)) {
            return;
        }

        req.client.save((err, user) => {
            if (req.msgGenerator.generateError(err, req, res)) {
                return;
            }

            res.end(req.msgGenerator.generateJSON('subscribeStock', 'OK'));
            req.logger.info('Юзер ' + user.login + ' подписался на акцию ' + stock._id);
        });
    });
});

router.post('/unsubscribe', mw.requireClientAuth, (req, res) => {
    Stock.findOne({'_id':new ObjectID(req.body.id)}, (err, stock) => {
        if (req.msgGenerator.generateError(err, req, res)) {return;}

        stock.removeSubscriber(req.client._id, (err) => {
            if (req.msgGenerator.generateError(err, req, res)) {return;}

            req.client.unsubscribe(stock._id);
            res.end(req.msgGenerator.generateJSON('unsubscribestock', 'success'));
        });
    });
});

router.get('/feed', mw.requireClientAuth, (req, res) => {
    req.client.getSubscribitions((err, stocks) => {
        if (req.msgGenerator.generateError(err, req, res)) {
            return;
        }

        res.end(req.msgGenerator.generateJSON('userstocks', stocks));
    });
});

router.get('/all', mw.requireClientAuth, (req, res) => {
    Stock.allToJSON(req.client._id.toString(), function (stocks) {
        res.end(req.msgGenerator.generateJSON('stock', stocks));
        req.logger.info('Отправил клиенту все акции');
    });
});


//TODO этот метод не работает. переделать!
router.get('/info', mw.requireClientAuth, (req, res) => {
    if (!req.query.id) {
        req.logger.warn('В запросе нет айди для поиска акции');
        res.end(req.msgGenerator.generateJSON('error', 'Не указан айди нужной акции'));
        return;
    }

    Stock.getByID(new ObjectID(req.query.id), (err, stock) => {
        if (req.msgGenerator.generateError(err, req, res)) {
            return;
        }

        req.logger.info('Отправляю информацию о акции с айди ' + req.query.id);
        res.end(req.msgGenerator.generateJSON('stock', stock));
    });
});

router.get('/me', mw.requireCompanyAuth, (req, res) => {
    Stock.byCompanyID(req.company._id, (stocks) => {
        req.logger.info('Отправляю клиенту акции компании ' + req.company.login);
        res.end(req.msgGenerator.generateJSON('stock', stocks));
    });
});

module.exports = router;
