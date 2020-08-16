export const SERVICES_OFFERED_GOOGLE_PAYLOAD = {
  expectUserResponse: true,
  systemIntent: {
    intent: "actions.intent.OPTION",
    data: {
      "@type": "type.googleapis.com/google.actions.v2.OptionValueSpec",
      listSelect: {
        title: "Packages",
        items: [
          {
            optionInfo: {
              key: "SELECTION_KEY_CUT",
              synonyms: ["synonym 1", "synonym 2", "synonym 3"],
            },
            description: "Cut and Shampoo. Lorum ipsum dorem kicksum",
            image: {
              url:
                "http://attentiontrust.org/wp-content/uploads/2018/01/Cool-Men%E2%80%99s-Haircut-best-men-hairstyle.jpg",
              accessibilityText: "simple hair cut",
            },
            title: "Simple Cut ($30)",
          },
          {
            optionInfo: {
              key: "SELECTION_KEY_STYLE",
              synonyms: [
                "Google Home Assistant",
                "Assistant on the Google Home",
              ],
            },
            description:
              "Cut, Shampoo, Style, Color, Blow dry. Lorum ipsum dorem kicksum",
            image: {
              url:
                "https://wallup.net/wp-content/uploads/2016/01/28579-profile-white_background-women-curly_hair-brunette-bare_shoulders-face-brown_eyes-748x468.jpg",
              accessibilityText: "hair style",
            },
            title: "Beauty Style ($50)",
          },
          {
            optionInfo: {
              key: "SELECTION_KEY_PREMIUM",
              synonyms: ["Google Pixel XL", "Pixel", "Pixel XL"],
            },
            description:
              "Hair Style package + Massage + Facial. Lorum ipsum dorem kicksum",
            image: {
              url:
                "http://www.sofiaestetic.bg/wp-content/uploads/2017/01/botox.jpg",
              accessibilityText: "massage",
            },
            title: "'The Works' Premium ($100)",
          },
        ],
      },
    },
  },
  richResponse: {
    items: [
      {
        simpleResponse: {
          textToSpeech: "Sure thing. Please select the package you'd prefer.",
        },
      },
    ],
  },
};
