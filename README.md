Event registration system
=========================

This system has been used for GUADEC 2015 and is currently being reworked to be more general
for use by other FOSS events, like Flock 2016.

[![Build Status](https://travis-ci.org/puiterwijk/regcfp.svg?branch=master)](https://travis-ci.org/puiterwijk/regcfp)
[![Coverage Status](https://coveralls.io/repos/github/puiterwijk/regcfp/badge.svg?branch=master)](https://coveralls.io/github/puiterwijk/regcfp?branch=master)

Develop status:

[![Build Status](https://travis-ci.org/puiterwijk/regcfp.svg?branch=develop)](https://travis-ci.org/puiterwijk/regcfp)
[![Coverage Status](https://coveralls.io/repos/github/puiterwijk/regcfp/badge.svg?branch=develop)](https://coveralls.io/github/puiterwijk/regcfp?branch=develop)


Get started
-----------

To run the code:
- git clone
- cp config/config.example.json config/config.json
- npm install
- npm start


Customising the registration form
---------------------------------

The registration fields are defined in the `config.json` file, in the
`registration.fields` section.

The registration form itself is defined by the theme, in a Handlebars template
named `registration/register.hbs`. Each field object from the configuration is
passed to this template, as `field_XXX` where XXX is the key used in the config
file. You can set arbitrary properties on the field object and use them in this
template.

There are also some special properties for field objects:

  * `type`: see below for list of types
  * `display_name`: name shown to the user
  * `short_display_name`: name used when listing all registrations
  * `required`: if this true and the field has empty value when the
    registration form is submitted, the user will see an error asking
    them to fill in the field.
  * `private`: if this is false, the field will be shown to anyone viewing
    the list of all registrations. If true, only admins will see the value
    of this field when listing all registrations.
  * `placeholder`: text to be shown when there's no value set. For use with
    `string` type fields.
  * `options`: a list of allowed options, to be used with `select` and
    `purchase` type fields

The following types of fields are supported:

  * `string`: a text field, to be used with an [input element]
  * `select`: a list of options, to be used with a [select element]
  * `country`: like a `select` field, but the `options` property will be
    populated with a list of all of the world's countries
  * `purchase`: a choice of items that can be purchased. To be used with a
    [select element].
  * `documentation`: this type of field is inserted directly as HTML, it's
    used to show extra text to the user rather than to hold a value.

A `purchase` field can contain a list of options, each with a price and a
maximum available amount. For example, you could offer T-shirts for purchase
at registration and allow attendees to choose from a list of sizes:

    options: {
        "S": {
            "limit": 4,
            "cost": 20
        },
        "M": {
            "limit": 15,
            "cost": 20
        },
        "L": {
            "limit": 5,
            "cost": 20
        }
    }

If `required` is false for a `purchase` field, a "None" option will be added to
the list provided.

See `config/config.example.json` for a full example.

[input element]: https://developer.mozilla.org/en/docs/Web/HTML/Element/input
[select element]: https://developer.mozilla.org/en/docs/Web/HTML/Element/select


Development tips
----------------

See HACKING.md.
