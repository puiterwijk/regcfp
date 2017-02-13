function login_prompt_test() {
    address = prompt("Please enter an email address to login as.");
    $.ajax({
      type: 'POST',
      url: '/auth/login/',
      data: {
        email: address
      },
      success: function(res, status, xhr) {
        window.location.reload();
      },
      error: function(xhr, status, err) {
        window.alert('Login failure: ' + err);
      }
    });
}

function logout_test() {
    $.ajax({
      type: 'POST',
      url: '/auth/logout/',
      success: function(res, status, xhr) {
        window.location = '/';
      },
      error: function(xhr, status, err) {
        window.alert('Logout failure: ' + err);
      }
    });
}
