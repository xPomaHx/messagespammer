const VK = require('vk-io');
const Group = require(appRoot + '/models/Group.js');
const config = require(appRoot + "/config");
module.exports = {
    addServ: async function(group) {
        try {
            var token = group.tokens[0];
            var vk = new VK.VK({
                apiTimeout: 600000,
                apiMode: "sequential",
                apiLimit: 20,
                apiExecuteCount: 1,
            });
            vk.setToken(token);
            var cs = (await vk.api.call('groups.getCallbackServers', {
                group_id: group.id,
            })).items.find((el) => {
                return el.url == config.botcallbackurl;
            });
            if (cs && cs.status == "ok" && group.confirmationCode) {
                //console.dir(cs);
                console.dir("server ok " + group.id);
                return;
            }
            if (cs) {
                (await vk.api.call('groups.deleteCallbackServer', {
                    group_id: group.id,
                    server_id: cs.id,
                }));
                console.dir("deleteCallbackServer " + group.id);
            }
            var csid = (await vk.api.call('groups.addCallbackServer', {
                group_id: group.id,
                url: config.botcallbackurl,
                title: "botplus"
            })).server_id;
            var confirmationCode = (await vk.api.call('groups.getCallbackConfirmationCode', {
                group_id: group.id
            })).code;
            group.confirmationCode = confirmationCode;
            await group.save();
            (await vk.api.call('groups.setCallbackSettings', {
                group_id: group.id,
                server_id: csid,
                message_new: 1,
                message_allow: 1,
            }));
            var msg = (await vk.collect.messages.getDialogs());
            var user_ids = msg.map((el) => {
                return el.message.user_id;
            });
            var members = (await vk.collect.groups.getMembers({
                group_id: group.id,
            }));
            user_ids = user_ids.concat(members);
            await group.update({
                $push: {
                    user_ids: {
                        $each: user_ids
                    },
                }
            });
            await group.save();
            console.dir("server added " + group.id);
        } catch (er) {
            /* if (er.code = 27) {
                 console.dir("удаляю " + token);
                 await Group.findOneAndUpdate({
                     id: group.id,
                 }, {
                     $pull: {
                         tokens: token,
                     }
                 });
             }*/
            console.dir("addServ er " + group.id + " " + er.code);
            console.dir(er);
        }
    }
}