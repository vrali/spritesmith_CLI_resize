# scaled-spritesmith-cli
Extension of spritesmith with cli capability and capability for generating css to scale images in sprite by taking in a handlebars template.
Usage:
In package.json

```javascript
"scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "costar-sprite-smith --config imageSpriteConfig.js"
  }
```

imageSpriteConfig.js Structure:

```javascript
{
    src: imageSource, // array of glob patterns
    imgDest: './content/images/go-sell-sprite.png',
    cssDest: './content/common/imageSprite.less',
    cssFormat: 'less',
    resizeConfig:  , //See Below for resizeConfig structure
    cssTemplate: './LessTemplate/Lesstemplate.handlebars',
    padding: 2,
    cssVarMap: function (sprite) {
        // add snake-case as a dependency 
        // the built in snake case does not seem to work
        sprite.name = snakeCase(sprite.name).split("_").join("-").toLowerCase();

        // changers.push(sprite);
    },
    cssHandlebarsHelpers: {
        imgPath: function (imgName) {
            return "/Content/images/" + imgName;
        },
        sourceImage: function (sourceImagePath) {
            return path.basename(sourceImagePath);
        }
    }
}
```

resizeConfig Structure:

```javascript
{
  "google-search": [ 18, 19 ], // generates icon-google-search
  "email": {
    "default": [ 29, 19 ],
    "small": [ 26, 17 ],
    "contacts": [22,14]
  }, //generates classes icon-email-default,icon-email-small,icon-email-contacts
  "edit-icon": {
    "@": [ 15, 16 ],
    "activity": [ 19, 20 ] //geenrates classes icon-edit-icon, icon-edit-icon-activity
  }
}
```
