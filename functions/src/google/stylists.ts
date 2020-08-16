export const STYLISTS_GOOGLE_PAYLOAD = {
  expectUserResponse: true,
  systemIntent: {
    intent: "actions.intent.OPTION",
    data: {
      "@type": "type.googleapis.com/google.actions.v2.OptionValueSpec",
      listSelect: {
        title: "Stylists",
        items: [
          {
            optionInfo: {
              key: "SELECTION_KEY_DOGAN",
              synonyms: ["synonym 1", "synonym 2", "synonym 3"],
            },
            image: {
              url:
                "http://attentiontrust.org/wp-content/uploads/2018/01/Cool-Men%E2%80%99s-Haircut-best-men-hairstyle.jpg",
              accessibilityText: "dogan",
            },
            title: "Dogan",
          },
          {
            optionInfo: {
              key: "SELECTION_KEY_JOHN",
              synonyms: [
                "Google Home Assistant",
                "Assistant on the Google Home",
              ],
            },
            image: {
              url:
                "https://wallup.net/wp-content/uploads/2016/01/28579-profile-white_background-women-curly_hair-brunette-bare_shoulders-face-brown_eyes-748x468.jpg",
              accessibilityText: "john",
            },
            title: "John",
          },
          {
            optionInfo: {
              key: "SELECTION_KEY_TUNGUY",
              synonyms: ["Google Pixel XL", "Pixel", "Pixel XL"],
            },
            image: {
              url:
                "http://www.sofiaestetic.bg/wp-content/uploads/2017/01/botox.jpg",
              accessibilityText: "tunguy",
            },
            title: "Tunguy",
          },
        ],
      },
    },
  },
  richResponse: {
    items: [
      {
        simpleResponse: {
          textToSpeech: "Please select a stylist",
        },
      },
    ],
  },
};
