## 1 should merge with target manifest/i18n with different names
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
---
manifest.appdescr_variant
    content
        texts: i18n/i18n.properties
    i18n
        i18n.properties
---
dist
    i18n
        hugo.properties (merged with i18n/i18n.properties)



## 2 should merge with target manifest/i18n with same name
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
---
manifest.appdescr_variant
    content
        texts: i18n/hugo.properties
    i18n
        hugo.properties
---
dist
    i18n
        hugo.properties (merged with i18n/hugo.properties)



## 3 should merge existing in baseApp properties
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
---
manifest.appdescr_variant
    content
        texts: i18n/ListObject/i18n.properties
    i18n
        ListObject
            i18n.properties
---
dist
    i18n
        hugo.properties (merged with i18n/ListObject/i18n.properties)



## 4 should copy existing in baseApp enahnceWith properties
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
---
manifest.appdescr_variant
    content
        enhanceWith: i18n/i18n.properties
    i18n
        i18n.properties
---
dist
    app_var_id
        i18n
            i18n.properties (copied from i18n/i18n.properties)
    i18n
        hugo.properties



## 5 should copy non-existing in baseApp enahnceWith properties
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
---
manifest.appdescr_variant
    content
        enhanceWith: i18n/ListObject/i18n.properties
    i18n
        ListObject
            i18n.properties
---
dist
    app_var_id
        i18n
            ListObject
                i18n.properties (copied from i18n/ListObject/i18n.properties)
    i18n
        hugo.properties



## 6 should not change the properties not referenced in manifest.json or changes
manifest.json
    i18n: i18n/hugo.properties
i18n
    doe.properties
---
manifest.appdescr_variant
    content
        texts: i18n/i18n.properties
    i18n
        doe.properties
---
dist
    i18n
        doe.properties (should not be changed)



## 7 should not copy the properties not referenced in manifest.json or changes
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
---
manifest.appdescr_variant
    content
        texts: i18n/i18n.properties
    i18n
        doe.properties
---
dist
    i18n
        hugo.properties (should not be changed)




## 8 should create translation if not existing
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
---
manifest.appdescr_variant
    content
        texts: i18n/i18n.properties
    i18n
        i18n.properties
        i18n_en.properties
---
dist
    i18n
        hugo.properties (merged with i18n/i18n.properties)
        hugo_en.properties (should be created)



## 9 should merge translation if existing
manifest.json
    i18n: i18n/hugo.properties
i18n
    hugo.properties
    hugo_en.properties
---
manifest.appdescr_variant
    content
        texts: i18n/i18n.properties
    i18n
        i18n.properties
        i18n_en.properties
---
dist
    i18n
        hugo.properties (merged with i18n/i18n.properties)
        hugo_en.properties (merged with i18n/i18n_en.properties)