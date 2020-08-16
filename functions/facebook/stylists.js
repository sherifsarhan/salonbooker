import stylists from "../google/stylists";

export default stylists = {
  attachment: {
    type: "template",
    payload: {
      template_type: "generic",
      elements: [
        {
          title: "Dogan",
          image_url:
            "http://attentiontrust.org/wp-content/uploads/2018/01/Cool-Men%E2%80%99s-Haircut-best-men-hairstyle.jpg",
          buttons: [
            {
              title: "Select Dogan",
              type: "postback",
              payload: "Select Dogan",
            },
          ],
        },
        {
          title: "John",
          image_url:
            "https://wallup.net/wp-content/uploads/2016/01/28579-profile-white_background-women-curly_hair-brunette-bare_shoulders-face-brown_eyes-748x468.jpg",
          buttons: [
            {
              title: "Select John",
              type: "postback",
              payload: "Select John",
            },
          ],
        },
        {
          title: "Tunguy",
          image_url:
            "http://www.sofiaestetic.bg/wp-content/uploads/2017/01/botox.jpg",
          buttons: [
            {
              title: "Select Tunguy",
              type: "postback",
              payload: "Select Tunguy",
            },
          ],
        },
      ],
    },
  },
};
