// Google Apps Script web app that emails admins when the community page reports a post.
// It lives in the Google account that owns it and sends mail as that account.
//
// Setup: script.google.com -> New project -> paste this file, replace SECRET with a long random
// string, run `authorize` once, then Deploy -> New deployment -> Web app
// (Execute as: Me, Who has access: Anyone). Give the Worker the /exec URL as APPS_SCRIPT_URL
// and the same SECRET as APPS_SCRIPT_SECRET.
var SECRET = "PASTE_A_LONG_RANDOM_SECRET_HERE";

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad request" });
  }

  if (!data || data.secret !== SECRET) {
    return reply({ ok: false, error: "unauthorized" });
  }

  var to = [].concat(data.to || []);
  var cc = [].concat(data.cc || []);
  if (to.length === 0 || to.length + cc.length > 10) {
    return reply({ ok: false, error: "bad recipients" });
  }

  MailApp.sendEmail({
    to: to.join(","),
    cc: cc.join(","),
    subject: String(data.subject || "").slice(0, 200),
    body: String(data.text || ""),
    htmlBody: data.html ? String(data.html) : undefined,
    name: "(un)Jaded Community"
  });
  return reply({ ok: true });
}

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run this once to give the script permission to send email
function authorize() {
  MailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    "(un)Jaded setup test",
    "Email sending is authorized. You can ignore this message."
  );
}
