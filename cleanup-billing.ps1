$token = 'frontend_token_1775409392'
$finId = 'oluckesz5t20umk7xahp6cj5'
$base = 'https://api.car4youpanama.com'

Write-Host "========================================"
Write-Host "PASO 1: BACKUP DE BILLING RECORDS"
Write-Host "========================================"

$url = "$base/api/billing-records?filters[financing][documentId][`$eq]=$finId&pagination[pageSize]=100"
$backup = Invoke-RestMethod -Uri $url -Headers @{Authorization="Bearer $token"}

$timestamp = Get-Date -Format yyyyMMdd_HHmmss
$backupPath = "billing-backup-$finId-$timestamp.json"
$backup | ConvertTo-Json -Depth 10 | Out-File $backupPath
Write-Host "Backup guardado: $backupPath ($($backup.data.Length) records)"

Write-Host ""
Write-Host "========================================"
Write-Host "PASO 2: ANALISIS DE parentRecord"
Write-Host "========================================"

$records = $backup.data
Write-Host "Total records: $($records.Length)"

# Mostrar estructura de parentRecord para confirmar formato
$records | Select-Object -First 8 | ForEach-Object {
    $pr = $_.parentRecord
    $prType = "null"
    if ($pr -ne $null) {
        if ($pr -is [array]) {
            $prType = "array[$($pr.Length)]"
        } elseif ($pr -is [PSCustomObject]) {
            $keys = ($pr | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)
            if ($keys.Count -eq 0) {
                $prType = "empty-obj"
            } else {
                $prType = "obj($($keys -join ', '))"
            }
        } else {
            $prType = "other"
        }
    }
    Write-Host "  $($_.documentId.Substring(0,8))... | q#=$($_.quotaNumber) | status=$($_.status) | amount=$($_.amount) | parentRecord=$prType"
}

Write-Host ""
Write-Host "========================================"
Write-Host "PASO 3: CLASIFICAR HIJOS Y PADRES"
Write-Host "========================================"

function IsRootRecord($record) {
    $pr = $record.parentRecord
    if ($pr -eq $null) { return $true }
    if ($pr -is [PSCustomObject]) {
        $keys = ($pr | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name)
        return ($keys.Count -eq 0) -or (-not ($keys -contains "id" -or $keys -contains "documentId"))
    }
    return $true
}

$hijos  = $records | Where-Object { -not (IsRootRecord $_) }
$padres = $records | Where-Object { IsRootRecord $_ }

Write-Host "Hijos (parentRecord poblado): $($hijos.Length)"
$hijos | ForEach-Object { Write-Host "  $($_.documentId) | q#=$($_.quotaNumber) | status=$($_.status) | amount=$($_.amount)" }

Write-Host "Padres (root / sin parent): $($padres.Length)"
$padres | ForEach-Object { Write-Host "  $($_.documentId) | q#=$($_.quotaNumber) | status=$($_.status) | amount=$($_.amount)" }

Write-Host ""
Write-Host "========================================"
Write-Host "PASO 4: ELIMINAR HIJOS PRIMERO"
Write-Host "========================================"

$erroresHijos = @()
foreach ($r in $hijos) {
    $id = $r.documentId
    $delUrl = "$base/api/billing-records/$id"
    try {
        Invoke-RestMethod -Uri $delUrl -Headers @{Authorization="Bearer $token"} -Method DELETE | Out-Null
        Write-Host "  [OK] Eliminado HIJO: $id (q#=$($r.quotaNumber), status=$($r.status))"
    } catch {
        $err = $_.Exception.Message
        Write-Host "  [FAIL] Error HIJO $id : $err"
        $erroresHijos += $id
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "PASO 5: ELIMINAR PADRES DESPUES"
Write-Host "========================================"

$erroresPadres = @()
foreach ($r in $padres) {
    $id = $r.documentId
    $delUrl = "$base/api/billing-records/$id"
    try {
        Invoke-RestMethod -Uri $delUrl -Headers @{Authorization="Bearer $token"} -Method DELETE | Out-Null
        Write-Host "  [OK] Eliminado PADRE: $id (q#=$($r.quotaNumber), status=$($r.status))"
    } catch {
        $err = $_.Exception.Message
        Write-Host "  [FAIL] Error PADRE $id : $err"
        $erroresPadres += $id
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "PASO 6: RESETEAR FINANCING"
Write-Host "========================================"

$finUrl = "$base/api/financings/$finId"
$finResp = Invoke-RestMethod -Uri $finUrl -Headers @{Authorization="Bearer $token"}
$totalAmount = $finResp.data.totalAmount
Write-Host "totalAmount original: $totalAmount"

$resetBody = @{
    data = @{
        paidQuotas           = 0
        totalPaid            = 0
        currentBalance       = $totalAmount
        partialPaymentCredit = 0
        totalLateFees        = 0
        status               = "activo"
    }
} | ConvertTo-Json -Depth 3

Invoke-RestMethod -Uri $finUrl -Headers @{Authorization="Bearer $token"; "Content-Type"="application/json"} -Method PUT -Body $resetBody | Out-Null
Write-Host "Financing reseteado: paidQuotas=0, totalPaid=0, balance=$totalAmount"

Write-Host ""
Write-Host "========================================"
Write-Host "PASO 7: VERIFICACION"
Write-Host "========================================"

$recordsAfter = Invoke-RestMethod -Uri $url -Headers @{Authorization="Bearer $token"}
Write-Host "Records restantes: $($recordsAfter.data.Length) (debe ser 0)"

$finAfter = Invoke-RestMethod -Uri $finUrl -Headers @{Authorization="Bearer $token"}
Write-Host "paidQuotas=$($finAfter.data.paidQuotas) | totalPaid=$($finAfter.data.totalPaid) | balance=$($finAfter.data.currentBalance) | status=$($finAfter.data.status)"

Write-Host ""
Write-Host "========================================"
Write-Host "RESUMEN"
Write-Host "========================================"
Write-Host "Backup: $backupPath"
Write-Host "Total borrados: $($hijos.Length + $padres.Length - $erroresHijos.Length - $erroresPadres.Length)"
Write-Host "Errores hijos: $($erroresHijos.Length)"
Write-Host "Errores padres: $($erroresPadres.Length)"
if ($recordsAfter.data.Length -eq 0 -and $finAfter.data.currentBalance -eq $totalAmount) {
    Write-Host "ESTADO: LIMPIO OK"
} else {
    Write-Host "ESTADO: REVISAR (quedan records o balance incorrecto)"
}
