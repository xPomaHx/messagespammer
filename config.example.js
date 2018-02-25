var home_url = "http://chat.bro-dev.tk";
var config = {
    VKio: {
        apiTimeout: 600000,
        apiMode: "parallel",
    },
    home_url,
    VK_APP_ID: 5167345,
    VK_APP_SECRET: '5ELsnK2EgSRsY3DWdher',
    VK_callbackURL: home_url + "/auth/vk/callback",
    VK_callbackURLcommunities: home_url + "/auth/vkcommunities",
};
module.exports = config;