const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'app/src/main/java/com/bilalgnd/saracapp/saracapp.kt');
let content = fs.readFileSync(file, 'utf-8');

const t1 = `                        val hapticFeedback = androidx.compose.ui.platform.LocalHapticFeedback.current
                        var accumulatedDrag by remember { mutableFloatStateOf(0f) }
                        
                        Button(onClick = { hafiza.kasaTokenKaydet(""); kasaAyarPenceresiAcik = false; isLogged = false }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF44336)), modifier = Modifier.fillMaxWidth()) { Text("Çıkış Yap", color = Color.White, fontWeight = FontWeight.Bold) }`;

const r1 = `                        val hapticFeedback = androidx.compose.ui.platform.LocalHapticFeedback.current
                        var accumulatedDrag by remember { mutableFloatStateOf(0f) }
                        
                        OutlinedTextField(
                            value = ipGirdisi,
                            onValueChange = { 
                                ipGirdisi = it
                                hafiza.kasaIpKaydet(it)
                            },
                            label = { Text("IP", color = Color.Gray) },
                            textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 16.sp),
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp, top = 16.dp)
                        )
                        
                        Text("Geçerli Hesap: sarac", color = Color.White, fontSize = 15.sp, modifier = Modifier.padding(bottom = 8.dp))

                        Button(onClick = { hafiza.kasaTokenKaydet(""); kasaAyarPenceresiAcik = false; isLogged = false }, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF44336)), modifier = Modifier.fillMaxWidth()) { Text("Çıkış Yap", color = Color.White, fontWeight = FontWeight.Bold) }`;

const t2 = `    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF1E1E1E),
        modifier = Modifier.fillMaxHeight(0.9f).fillMaxWidth(0.95f),
        title = { Text("Sistem Logları", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.fillMaxSize()) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color(0xFFFF9800), modifier = Modifier.align(Alignment.CenterHorizontally))
                } else if (errorMsg.isNotEmpty()) {
                    Text(errorMsg, color = Color.Red, modifier = Modifier.padding(16.dp))
                } else if (logs.isEmpty()) {
                    Text("Henüz bir sistem logu bulunmuyor.", color = Color.Gray, modifier = Modifier.padding(16.dp))
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        items(logs) { log ->
                            val bgColor = when (log.type) {
                                "success" -> Color(0xFF1B5E20)
                                "error" -> Color(0xFFB71C1C)
                                "warning" -> Color(0xFFF57F17)
                                else -> Color(0xFF424242)
                            }
                            Column(modifier = Modifier.fillMaxWidth().background(bgColor, RoundedCornerShape(8.dp)).padding(12.dp)) {
                                Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                                    Text(log.source, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                    Text(log.time, color = Color.LightGray, fontSize = 12.sp)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(log.message, color = Color.White, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4CAF50))) {
                Text("Kapat")
            }
        }
    )`;

const r2 = `    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color.Black,
        modifier = Modifier.fillMaxHeight(0.9f).fillMaxWidth(0.95f),
        title = { Text("saracapp@terminal:~$ tail -f /var/log/system.log", color = Color(0xFF4CAF50), fontSize = 14.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace) },
        text = {
            Column(modifier = Modifier.fillMaxSize()) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color(0xFFFF9800), modifier = Modifier.align(Alignment.CenterHorizontally))
                } else if (errorMsg.isNotEmpty()) {
                    Text(errorMsg, color = Color.Red, modifier = Modifier.padding(16.dp), fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                } else if (logs.isEmpty()) {
                    Text("Henüz bir sistem logu bulunmuyor.", color = Color.Gray, modifier = Modifier.padding(16.dp), fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace)
                } else {
                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        items(logs) { log ->
                            val textColor = when (log.type) {
                                "success" -> Color(0xFF4CAF50)
                                "error" -> Color(0xFFF44336)
                                "warning" -> Color(0xFFFFC107)
                                else -> Color.White
                            }
                            val prefix = if (log.source.isNotEmpty()) "[${log.time}] [${log.source}] " else "[${log.time}] "
                            Text(prefix + log.message, color = textColor, fontSize = 13.sp, fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, modifier = Modifier.padding(vertical = 2.dp))
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = onDismiss, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF424242)), shape = RoundedCornerShape(50)) {
                Text("Kapat", color = Color.White)
            }
        }
    )`;

content = content.replace(t1, r1);
content = content.replace(t2, r2);

fs.writeFileSync(file, content, 'utf-8');
console.log("Done");
