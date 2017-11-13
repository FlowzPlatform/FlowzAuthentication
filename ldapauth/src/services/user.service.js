const { json, send } = require('micro')
const { sign, verify } = require('jsonwebtoken');
const _ = require('lodash')
const ldapConfig = require('../config.js');
const cors = require('micro-cors')()

var Ajv = require('ajv');
var ajv = new Ajv({ allErrors: true });

const ldapschema = require('../schema/schema.js')

var ldap = require('ldapjs');
console.log(ldapConfig.ldapUrl);
var client = ldap.createClient({
    url: ldapConfig.ldapUrl
});

var self = {
    userlist: async(req, res) => {
        try {
            console.log(req);
            console.log(res);

            console.log(ldapConfig.adminDn);
            client.bind(ldapConfig.adminDn, ldapConfig.adminPass, function(err) {
                console.log(err);
            });

            return "userslist..";

        } catch (err) {
            console.log(err);
        }
    },

    abc: async(a) => {
        console.log(a);
    },

    ldapbind: async(strBindDn, strPass) => {

        console.log("==========================================");
        console.log("ldapbind :: " + strBindDn);
        console.log("==========================================");
        let isAuth = false;
        return new Promise((resolve, reject) => {
            client.bind(strBindDn, strPass, function(err) {
                //assert.ifError(err);
                if (!err) {
                    isAuth = true;
                }
                console.log(err);
                resolve({ 'auth': isAuth });
            });
        });

    },

    ldapentry: async(strDn, entry) => {

        console.log("==========================================");
        console.log("entry into :: " + strDn);
        console.log(entry);
        console.log("==========================================");

        return new Promise((resolve, reject) => {
            client.add(strDn, entry, function(err, res) {
                console.log("err :: " + err);
                console.log("res :: " + res);

                if (!err)
                    resolve(true);

                resolve(false);
            });
        });
    },

    ldapmodify: async(strDn, attrs, operation) => {

        console.log("==========================================");
        console.log("ldapmodify :: " + strDn + "==" + operation);
        console.log(attrs);
        console.log("==========================================");

        return new Promise((resolve, reject) => {

            var change = new ldap.Change({
                operation: operation,
                modification: attrs
            });

            client.modify(strDn, change, function(err, res) {
                if (err) {
                    console.error("modify err %j", err);
                    resolve(false);
                } else {
                    console.error("modify worked");
                    resolve(true);
                }
            });
        });

    },

    ldapsearch: async(strDn, options) => {

        console.log("==========================================");
        console.log("searching for :: " + strDn);
        console.log(options);
        console.log("==========================================");

        let searchData = [];
        return new Promise((resolve, reject) => {

            client.search(strDn, options, function(err, res) {
                //assert.ifError(err);
                //console.log(err);

                res.on('searchEntry', function(entry) {
                    console.log('entry: ' + JSON.stringify(entry.object));
                    searchData.push(entry.object)
                        //resolve({'event':'searchEntry','reponse':entry.object});
                });
                res.on('searchReference', function(referral) {
                    console.log('referral: ' + referral.uris.join());
                    //resolve({'event':'searchReference','reponse':referral.uris.join()});
                });
                res.on('error', function(err) {
                    console.error('error: ' + err.message);
                    resolve({});
                    //resolve({'event':'error','reponse':err.message});
                });
                res.on('end', function(result) {
                    console.log('status: ' + result.status);
                    resolve({ 'response': searchData });
                });
            });
        });

    },

    getroles: async() => {

        var searchOptions = {
            filter: '(objectClass=posixGroup)',
            scope: 'sub',
            attributes: ['cn']
        };

        var strDn = ldapConfig.groupDn;
        var result = await self.ldapsearch(strDn, searchOptions);

        console.log("result :::::::::::::::::::::");
        console.log(result);

        var roles = [];
        for (var p in result.response) {
            if (result.response.hasOwnProperty(p)) {
                console.log("=========" + result.response[p].cn);
                roles.push(result.response[p].cn)
            }
        }
        console.log(roles);

        let allRoles = {
            'status': 1,
            'data': {
                'roles': roles
            }
        }

        return allRoles;
    },

    userroles: async(uid) => {

        var searchOptions = {
            filter: '(memberUid=' + uid + ')',
            scope: 'sub',
            attributes: ['cn']
        };
        console.log(strDn);
        var strDn = 'ou=groups,' + ldapConfig.ldapDc;
        var result = await self.ldapsearch(strDn, searchOptions);

        console.log("result :::::::::::::::::::::");
        console.log(result);

        var userRoles = [];
        for (var p in result.response) {
            if (result.response.hasOwnProperty(p)) {
                console.log("=========" + result.response[p].cn);
                userRoles.push(result.response[p].cn)
            }
        }
        console.log(userRoles);

        return userRoles;
    },

    useradd: async(req, res) => {

        try {
            const body = await json(req)
            console.log(body);

            console.log("admin dn :: " + ldapConfig.adminDn);
            var isAdminAuth = isUserAuth = false;
            isAdminAuth = await self.ldapbind(ldapConfig.adminDn, ldapConfig.adminPass);

            console.log("admin auth :: " + isAdminAuth.auth);

            if (isAdminAuth.auth) {
                //  admin is authenticated, search for given user
                var searchOptions = {
                    filter: '(uid=' + body.userid + ')',
                    //filter: '(cn=*)',
                    scope: 'sub'
                        //attributes: ['dn', 'sn', 'cn']
                };

                var strDn = 'ou=users,' + ldapConfig.ldapDc;
                console.log(strDn);
                var result = await self.ldapsearch(strDn, searchOptions);

                console.log('==================================');
                if (result.response.length) {
                    console.log('user found..');

                } else {
                    console.log('add user..');

                    var entry = {
                        cn: 'brett1',
                        sn: 'abc',
                        gidNumber: 501,
                        givenname: 'brett1',
                        homedirectory: '/home/users/brett1',
                        objectclass: ['inetOrgPerson', 'posixAccount', 'top'],
                        //  objectclass: 'posixAccount',
                        //  objectclass: 'top',
                        sn: 'abc',
                        uid: 'brett1',
                        uidNumber: 1006,
                        userpassword: '123'
                            //  email: ['foo@bar.com', 'foo1@bar.com'],
                            //  objectclass: 'fooPerson'
                    };
                    client.add('cn=brett1,ou=users,dc=ldaptest,dc=local', entry, function(err) {
                        console.log(err);
                    });
                }
            }
        } catch (err) {

            console.log(err);
        }

        send(res, 200, {})
    },

    setPermission: cors(async(req, res) => {
        try {
            const body = await json(req)
            console.log(body);
            console.log("schema", ldapschema.setPermission)

            let resCode = 200;
            let resBody = {};

            var valid = ajv.validate(ldapschema.setPermission, body);
            if (!valid) {
                resCode = 404;
                resBody = { 'status': 0, 'code': 404, 'error': ajv.errors }
                send(res, resCode, resBody)
            }

            var isAdminAuth = isUserAuth = false;
            isAdminAuth = await self.ldapbind(ldapConfig.adminDn, ldapConfig.adminPass);

            if (isAdminAuth.auth) {

                const dnAppRootPath = "ou=" + ldapConfig.approot + "," + ldapConfig.ldapDc;
                const dnAppPath = "ou=" + body.app + "," + dnAppRootPath;
                const dnTaskTypeNs = "ou=" + ldapConfig.tasktype + "," + dnAppPath;
                const dnTaskTypePath = "ou=" + body.taskType + "," + dnTaskTypeNs;

                // check/create given task-type
                if (await self.checkOrgUnit(body.taskType, dnTaskTypePath)) {

                    // chcek/create "role" as ou exist or not
                    var dnRoleOu = "ou=roles," + dnTaskTypePath;
                    if (await self.checkOrgUnit("roles", dnRoleOu)) {

                        // check/create given role exist or not
                        var dnRolePath = "cn=" + body.roleId + "," + dnRoleOu;
                        if (await self.checkOrgRole(body.roleId, dnRolePath)) {

                            // check/create given resource exist or not
                            var dnResourcePath = "ou=" + body.resourceId + ",ou=resources," + dnAppPath;
                            if (await self.checkOrgUnit(body.resourceId, dnResourcePath)) {

                                console.log("if..");
                                var attrs = {
                                    roleOccupant: [dnResourcePath]
                                }
                                await self.ldapmodify(dnRolePath, attrs, 'add');

                                // check if changing attr "l" already exist

                                await self.updateResourceAccess(dnRolePath, body.resourceId, body.accessValue);

                            } else {
                                console.log("else..");
                            }

                        }

                    }

                }

                resBody = { 'status': 1, 'message': 'Permission set successfully' };
            } else {
                resCode = 404;
                resBody = { 'status': 0, 'message': 'Authentication failed' }
            }
            send(res, resCode, resBody);

        } catch (err) {
            console.log(err);
        }
    }),

    updateResourceAccess: async(dnRolePath, resourceId, accessValue) => {

        console.log("inside updateResourceAccess............")
        try {

            console.log(dnRolePath + "====" + resourceId + "====" + accessValue);

            let opts = {
                scope: 'sub',
                attributes: ['l']
            }
            let resAcc = await self.ldapsearch(dnRolePath, opts);

            if (resAcc && !_.isEmpty(resAcc.response)) {
                // replace current res with new accessVal
                console.log(resAcc.response[0].l);

                if (resAcc.response[0].l) {
                    console.log('***********************----------------------');
                    console.log(resAcc);
                    let objAttrL;
                    if (_.isObject(resAcc.response[0].l)) {
                        console.log('inside if.....................................');
                        objAttrL = resAcc.response[0].l
                    } else {
                        console.log('inside else.....................................');
                        objAttrL = [resAcc.response[0].l];
                    }

                    let currentAttr;
                    console.log('========================' + objAttrL + '-------------------------');
                    if (objAttrL) {
                        console.log('=======================================@@@@@===================================');
                        currentAttr = _.find(objAttrL, function(str) {
                            let strL = str.substring(0, str.indexOf(':'));
                            console.log("***" + resourceId);
                            console.log("=============" + strL + "***" + str + "---");

                            //return num % 2 == 0;
                            return (strL == resourceId);
                        })
                    }

                    console.log('====currentAttr====');
                    console.log(currentAttr);

                    if (currentAttr) {
                        var attrs = {
                            l: [currentAttr]
                        }
                        await self.ldapmodify(dnRolePath, attrs, 'delete');
                    }
                }

            }

            // add new res with accessVal
            var attrs = {
                l: [resourceId + ":" + accessValue]
            }
            await self.ldapmodify(dnRolePath, attrs, 'add');

            console.log(resAcc.response[0].l)


        } catch (err) {
            console.log(err)
        }
    },

    getPermission: cors(async(req, res) => {
        try {
            //const body = await json(req)
            console.log(req.params);

            var isAdminAuth = isUserAuth = false;
            isAdminAuth = await self.ldapbind(ldapConfig.adminDn, ldapConfig.adminPass);

            if (isAdminAuth.auth) {

                const dnAppRootPath = "ou=" + ldapConfig.approot + "," + ldapConfig.ldapDc;
                const dnAppPath = "ou=" + req.params.app + "," + dnAppRootPath;
                const dnTaskTypeNs = "ou=" + ldapConfig.tasktype + "," + dnAppPath;
                const dnTaskTypePath = "ou=" + req.params.taskType + "," + dnTaskTypeNs;

                //  cn=113dbe20-588c-4e48-bb35-35cb17a3fd65,ou=roles,ou=cd930dbb-9e11-42f2-80d2-fa9862f55e12,ou=tasktype,ou=todoapp,ou=apps,dc=ldaptest,dc=local
                const searchPath = "cn=" + req.params.roleId + ",ou=roles," + dnTaskTypePath;
                const roleOcc = "ou=" + req.params.resourceId + ",ou=resources," + dnAppPath;

                var opt = {
                    filter: '(roleOccupant=' + roleOcc + ')',
                    scope: 'sub',
                    attributes: ['l']
                };

                var res = await self.ldapsearch(searchPath, opt);

                console.log('===============================');
                console.log(res);
                console.log('################################');
                let resourceAccess;
                if (!_.isEmpty(res.response)) {

                    console.log(res.response[0].l);
                    let objAttrL;
                    if (_.isObject(res.response[0].l)) {
                        objAttrL = res.response[0].l
                    } else {
                        objAttrL = [res.response[0].l];
                    }
                    console.log('===========--------------');
                    console.log(objAttrL);
                    resourceAccess = _.find(objAttrL, function(str) {
                        let strL = str.substring(0, str.indexOf(':'));
                        console.log("***" + req.params.resourceId);
                        console.log("=============" + strL + "***" + str + "---");

                        //return num % 2 == 0;
                        return (strL == req.params.resourceId);
                    })
                }
                console.log("====----=====" + resourceAccess);
                let accVal = 0;
                if (resourceAccess) {
                    accVal = resourceAccess.substring(resourceAccess.indexOf(':') + 1);
                }

                return { 'status': 1, 'data': { 'accessValue': accVal } };
            }
        } catch (err) {
            console.log(err)
        }
    }),

    getAllPermission: cors(async(req, res) => {
        try {
            //const body = await json(req)
            console.log(req.params);

            var isAdminAuth = isUserAuth = false;
            isAdminAuth = await self.ldapbind(ldapConfig.adminDn, ldapConfig.adminPass);

            if (isAdminAuth.auth) {

                const dnAppRootPath = "ou=" + ldapConfig.approot + "," + ldapConfig.ldapDc;
                const dnAppPath = "ou=" + req.params.app + "," + dnAppRootPath;
                const dnTaskTypeNs = "ou=" + ldapConfig.tasktype + "," + dnAppPath;
                const dnTaskTypePath = "ou=" + req.params.taskType + "," + dnTaskTypeNs;

                //  cn=113dbe20-588c-4e48-bb35-35cb17a3fd65,ou=roles,ou=cd930dbb-9e11-42f2-80d2-fa9862f55e12,ou=tasktype,ou=todoapp,ou=apps,dc=ldaptest,dc=local
                const searchPath = "cn=" + req.params.roleId + ",ou=roles," + dnTaskTypePath;
                const roleOcc = "ou=" + req.params.resourceId + ",ou=resources," + dnAppPath;

                var opt = {
                    filter: '(objectClass=organizationalRole)',
                    scope: 'sub',
                    //attributes: ['cn', 'l']
                };

                var res = await self.ldapsearch(dnTaskTypeNs, opt);

                console.log('===============================');
                console.log(res.response);
                console.log('################################');
                let resourceAccess;
                let allPerm = [];
                if (!_.isEmpty(res.response)) {

                    _.forEach(res.response, function(value) {
                        console.log(value.dn);
                        var reTasktype = value.dn.match("ou=roles,ou=(.*),ou=tasktype");
                        console.log(reTasktype[1]);
                        let strTasktype = reTasktype[1];

                        console.log('************');
                        console.log(value.l);
                        console.log('--------------');

                        let objAttrL;
                        if (_.isObject(value.l)) {
                            objAttrL = value.l
                        } else {
                            objAttrL = [value.l];
                        }

                        _.forEach(objAttrL, function(valL) {
                            let objResAcc = _.split(valL, ':');
                            let obj = {
                                    'taskType': strTasktype,
                                    'roleId': value.cn,
                                    'resourceId': objResAcc[0],
                                    'access_value': objResAcc[1],
                                }
                                //console.log('inner for.....' + valL);
                            allPerm.push(obj);
                        })
                    });

                }
                console.log(allPerm);

                return { 'status': 1, 'data': allPerm };
            }
        } catch (err) {
            console.log(err)
        }
    }),

    checkOrgUnit: async(unitName, strDn) => {
        console.log("unitname:", unitName)

        var result = await self.ldapsearch(strDn, {});

        if (_.isEmpty(result)) {
            console.log(unitName + " ==== not found..");
            let entry = {
                ou: unitName,
                objectclass: ['organizationalUnit'],
            }
            return await self.ldapentry(strDn, entry);
        }

        return true;
    },

    checkOrgRole: async(roleName, strDn) => {

        var result = await self.ldapsearch(strDn, {});

        if (_.isEmpty(result)) {

            console.log(roleName + " ==== not found..");

            let entry = {
                cn: roleName,
                objectclass: ['organizationalRole'],
            }
            return await self.ldapentry(strDn, entry);
        }

        return true;
    },

    init: cors(async(req, res) => {
        console.log('inside init....');
        const body = await json(req)
        console.log(body);

        var isAdminAuth = isUserAuth = false;
        isAdminAuth = await self.ldapbind(ldapConfig.adminDn, ldapConfig.adminPass);

        if (isAdminAuth.auth) {

            appName = body.app;
            // check if unit "apps" exist or not
            const dnAppRootPath = "ou=" + ldapConfig.approot + "," + ldapConfig.ldapDc;
            await self.checkOrgUnit(ldapConfig.approot, dnAppRootPath)

            // console.log('============================================');
            // console.log('Please provide app name');
            // console.log('============================================');

            // check if unit given app exist or not
            const dnAppPath = "ou=" + appName + "," + dnAppRootPath;
            await self.checkOrgUnit(appName, dnAppPath)

            // check "taskType" as "resources" as unit inside given app
            const dnTaskTypeNs = "ou=" + ldapConfig.tasktype + "," + dnAppPath;
            await self.checkOrgUnit(ldapConfig.tasktype, dnTaskTypeNs);

            const dnResourceNs = "ou=" + ldapConfig.resources + "," + dnAppPath;
            await self.checkOrgUnit(ldapConfig.resources, dnResourceNs);

            const dnUserPath = "ou=" + ldapConfig.userNs + "," + ldapConfig.ldapDc;
            await self.checkOrgUnit(ldapConfig.groupNs, dnUserPath)

            const dnRolePath = "ou=" + ldapConfig.groupNs + "," + ldapConfig.ldapDc;
            await self.checkOrgUnit(ldapConfig.groupNs, dnRolePath)

            send(res, 200, { message: 'Ldap server initalized.' })
        } else {
            send(res, 403, { message: 'Authentication error.' })
        }

    }),

    userauth: cors(async(req, res) => {

        /*
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With")
        */
        try {
            const body = await json(req)
                //send(res, 200, body)

            console.log(body);
            //console.log(res);

            console.log("schema", ldapschema.userAuth)


            var valid = ajv.validate(ldapschema.userAuth, body);

            if (!valid) {
                let resCode = 404;
                let resBody = { 'status': 0, 'code': 404, 'error': ajv.errors }
                send(res, resCode, resBody)
                    // console.log('Invalid: ', ajv.errors);
                return;
            }

            //self.abc("1111111111111111111");
            //return;
            console.log("admin dn :: " + ldapConfig.adminDn);
            var isAdminAuth = isUserAuth = false;
            isAdminAuth = await self.ldapbind(ldapConfig.adminDn, ldapConfig.adminPass);

            console.log("admin auth :: " + isAdminAuth.auth);

            if (isAdminAuth.auth) {
                //  admin is authenticated, search for given user
                var searchOptions = {
                    filter: '(uid=' + body.userid + ')',
                    //filter: '(cn=*)',
                    scope: 'sub'
                        //attributes: ['dn', 'sn', 'cn']
                };

                var strDn = 'ou=users,' + ldapConfig.ldapDc;
                console.log(strDn);
                var result = await self.ldapsearch(strDn, searchOptions);

                console.log('==================================');
                if (result.response.length) {
                    console.log(result.response[0]);

                    let searchUserDn = result.response[0].dn;

                    isUserAuth = await self.ldapbind(searchUserDn, body.passwd);

                    if (isUserAuth.auth) {
                        console.log("fetch user groups ::::::::::: ");
                        ///var userAssignedRoles = await self.userroles(body.userid);

                        var userData = {
                            'authenticated': true,
                            'uid': body.userid,
                            ///'roles': userAssignedRoles
                        }

                        var token = sign(userData, ldapConfig.jwtKey);

                        var authRes = { 'status': 1, 'code': 200, 'message': 'succesfully authenticated', 'token': token };

                        send(res, 200, authRes);

                        return;
                        //return isUserAuth;
                    } else {
                        send(res, 404, { 'status': 0, 'code': 404, 'message': 'authentication failed', 'error': 'invalid credentials' });
                        return;
                    }
                } else {
                    send(res, 404, { 'status': 0, 'code': 404, 'message': 'authentication failed', 'error': 'invalid credentials' });
                    return;
                }
            }

            send(res, 404, { 'auth': false });

            /*
            var isUserAuth = false;
            const strBind = 'cn='+body.userid+',ou=users,'+ldapDc;
            console.log(strBind);

            return new Promise((resolve, reject) => {
              client.bind(strBind, body.passwd, function(err) {
                //assert.ifError(err);

                if(!err)
                  isUserAuth = true;

                console.log(err);

                resolve({ "auth": isUserAuth })
              });
            });
            */

        } catch (err) {
            console.log(err);
            /*
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
            res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT,DELETE');
            res.setHeader("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With")
            */
            send(res, 403, { 'auth': false, 'error': err });
            //throw createError(403, 'error!');
        }

        return;
    })
};

module.exports = self;