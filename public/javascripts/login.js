navigator.id.watch({
    loggedInUser: currentUser,
    onlogin: function(assertion) {
        $.ajax({
          type: 'POST',
          url: '/auth/login/',
          data: {
            assertion: assertion
          },
          success: function(res, status, xhr) {
            window.location.reload();
          },
          error: function(xhr, status, err) {
            navigator.id.logout();
            window.alert('Login failure: ' + err);
          }
        });
    },
    onlogout: function() {
        $.ajax({
          type: 'POST',
          url: '/auth/logout/',
          success: function(res, status, xhr) {
            window.location.reload();
          },
          error: function(xhr, status, err) {
            window.alert('Logout failure: ' + err);
          }
        });
    }
});
