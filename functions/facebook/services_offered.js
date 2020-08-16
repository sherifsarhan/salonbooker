export default services_offered = {
  attachment: {
    type: "template",
    payload: {
      template_type: "generic",
      elements: [
        {
          title: "Simple Cut ($30)",
          image_url:
            "http://attentiontrust.org/wp-content/uploads/2018/01/Cool-Men%E2%80%99s-Haircut-best-men-hairstyle.jpg",
          subtitle: "Cut and Shampoo. Lorum ipsum dorem kicksum",
          buttons: [
            {
              title: "Select Simple Cut",
              type: "postback",
              payload: "Select Simple Cut",
            },
          ],
        },
        {
          title: "Hair Style ($50)",
          image_url:
            "https://wallup.net/wp-content/uploads/2016/01/28579-profile-white_background-women-curly_hair-brunette-bare_shoulders-face-brown_eyes-748x468.jpg",
          subtitle:
            "Cut, Shampoo, Style, Color, Blow dry. Lorum ipsum dorem kicksum.",
          buttons: [
            {
              title: "Select Hair Style",
              type: "postback",
              payload: "Select Hair Style",
            },
          ],
        },
        {
          title: "'The Works' Premium ($50)",
          image_url:
            "http://www.sofiaestetic.bg/wp-content/uploads/2017/01/botox.jpg",
          subtitle:
            "Cut, Shampoo, Style, Color, Blow dry. Lorum ipsum dorem kicksum.",
          buttons: [
            {
              title: "Select 'The Works' Premium",
              type: "postback",
              payload: "Select 'The Works' Premium",
            },
          ],
        },
      ],
    },
  },
};
