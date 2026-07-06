// 邮箱验证码 HTML 模板 - 匹配图片中的样式
function renderVerificationEmail(code) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>蓝天云邮箱验证</title>
</head>
<body style="margin:0;padding:0;background-color:#F0F0F0;font-family:'PingFang SC','Microsoft YaHei','Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F0F0F0;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

          <!-- 头部蓝色横幅 -->
          <tr>
            <td align="center" bgcolor="#0066FF" style="background-color:#0066FF;padding:34px 20px 30px 20px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td valign="middle" style="padding-right:14px;">
                    <div style="width:52px;height:52px;background-color:#FFFFFF;border-radius:12px;text-align:center;line-height:52px;font-size:30px;font-weight:bold;color:#0066FF;font-family:Arial,sans-serif;">L</div>
                  </td>
                  <td valign="middle" style="color:#FFFFFF;font-size:24px;font-weight:600;letter-spacing:0.5px;">Blue sky and clouds</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- 内容主体 -->
          <tr>
            <td style="background-color:#F8F9FA;padding:42px 28px 34px 28px;" align="center">

              <h1 style="margin:0 0 8px 0;color:#333333;font-size:22px;font-weight:600;text-align:center;">邮箱验证</h1>
              <p style="margin:0 0 26px 0;color:#666666;font-size:15px;text-align:center;">请使用以下验证码完成注册</p>

              <!-- 验证码框 -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="background-color:#E8F0FE;border:1px solid #B8D4F0;border-radius:10px;padding:24px 56px;">
                    <span style="color:#0066FF;font-size:40px;font-weight:bold;font-family:'SF Mono',Monaco,'Courier New',monospace;letter-spacing:12px;">${code}</span>
                  </td>
                </tr>
              </table>

              <!-- 提示列表 -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin-top:30px;">
                <tr>
                  <td style="padding:5px 0;color:#666666;font-size:14px;line-height:1.6;">
                    <span style="color:#0066FF;font-size:16px;vertical-align:middle;">•</span>&nbsp;&nbsp;验证码 10 分钟内有效
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#666666;font-size:14px;line-height:1.6;">
                    <span style="color:#0066FF;font-size:16px;vertical-align:middle;">•</span>&nbsp;&nbsp;请勿将验证码泄露给他人
                  </td>
                </tr>
                <tr>
                  <td style="padding:5px 0;color:#666666;font-size:14px;line-height:1.6;">
                    <span style="color:#0066FF;font-size:16px;vertical-align:middle;">•</span>&nbsp;&nbsp;如非本人操作，请忽略此邮件
                  </td>
                </tr>
              </table>

              <!-- 签名 -->
              <p style="margin:28px 0 0 0;color:#666666;font-size:14px;text-align:right;">蓝天云运行团队</p>

            </td>
          </tr>

          <!-- 底部 -->
          <tr>
            <td align="center" style="background-color:#FFFFFF;padding:20px;border-top:1px solid #EEEEEE;">
              <p style="margin:0 0 4px 0;color:#999999;font-size:12px;">此邮件由系统自动发送，请勿回复</p>
              <p style="margin:0;color:#999999;font-size:12px;">© 2026 Blue sky and clouds. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = { renderVerificationEmail };
