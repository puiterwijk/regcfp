Logging configuration
---------------------

To disable logging of every SQL statement on the console, set
`database.logging` to `false` in your config.json file.


Testing the OpenID Connect integration
--------------------------------------

The OpenID Connect authentication provider should work with any OpenID Connect
server.[1]

It is tested against [Ipsilon](https://pagure.io/ipsilon/). You can set up a
local Ipsilon instance for testing against roughly as follows.

First run a test instance (you may need to install its deps, of course):

    git clone https://pagure.io/ipsilon/
    cd ipsilon
    ./quickrun.py

Then go to http://localhost:8080/ where it should be running. Click 'Log in'
and use the credentials "admin" password "ipsilon".

Now go to http://localhost:8080/admin. Select "Identity Providers", then click the
"Manage" link for the OpenID Connect plugin.

Under "Clients", click "Add new". Enter an ID, name, and the redirect URI (for
an instance of regcfp started with `npm start`, that should be
`http://localhost:3000/auth/login/return`. Set the "Application type" to
"native", so that http:// is allowed.  Leave other settings as defaults and
click "Save".

Now edit config.json to have this stanza:

    "auth": {
      "module": "openid-connect",
      "issuer": "http://localhost:8080/openidc/",
      "client_id": "<id that you chose>",
      "client_secret": "<secret that Ipsilon generated>"
    },

Start a local regcfp instance, and click Log in. You should be forwarded to
Ipsilon, and since you're already logged in as "admin" it will return the info
for that user.


[1]. And everyone should be nice to each other all the time.
