import { PurchasingOrderModel } from './../purchasingOrder';
import Knex = require('knex');
import * as moment from 'moment';
import * as express from 'express';
import { log } from 'util';
import { start } from 'repl';
export class PurchasingOrderReportModel {

    detail(knex: Knex, id: string) {
        return knex('pc_purchasing_order as po')
            .where('po.purchase_order_id', id);
    }
    async hospital(knex: Knex) {
        let array = [];
        let result = await this.hospname(knex);
        result = JSON.parse(result[0].value);
        array.push(result);
        return array[0];
    }
    hospname(knex: Knex) {
        return knex.select('value').from('sys_settings').where('action_name', 'SYS_HOSPITAL');
    }
    at(knex: Knex) {
        let sql = `SELECT * FROM sys_settings WHERE action_name='BOOK_PREFIX'`;
        return knex.raw(sql);
    }
    budgetYear(knex: Knex, year) {
        let sql = `SELECT b.bgtype_name,
    SUM(bd.amount) AS amount,
    bd.bg_year
    FROM bm_bgtype b
    JOIN bm_budget_detail bd ON bd.bgtype_id=b.bgtype_id
    WHERE bd.bg_year = ?
    GROUP BY bd.bg_year`
        return knex.raw(sql, [year])
    }
    budgetType(knex: Knex, bgdetailId: any) {
        return knex('view_budget_subtype')
            .select('bgtype_id', 'bgtype_name', 'bgtypesub_name', 'amount', knex.raw('bg_year+543 as bg_year'))
            .where('view_bgdetail_id', bgdetailId);
    }
    budgetTypeRemark(knex: Knex, bgdetail_id: any) {
        return knex.raw(`SELECT remark,bgtype_id,bgtype_name,bgtypesub_name,amount,bg_year+543 as bg_year FROM view_budget_subtype WHERE bgdetail_id=?`, [bgdetail_id])
    }
    items(knex: Knex, id: string) {
        return knex('pc_purchasing_order_item as i')
            .innerJoin('mm_products as p', 'i.product_id', 'p.product_id')
            .innerJoin('view_generics', 'i.generic_id', 'view_generics.generic_id')
            .where('i.purchase_order_id', id);
    }
    prettyDate(date) {
        let d = date.getDate();
        const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
            "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
        let m = monthNames[date.getMonth()];
        let y = date.getFullYear() + 543;
        return d + ' ' + m + ' ' + y;
    }
    purchasingOrder(knex: Knex, purchaOrderId) {
        return knex.raw(`SELECT
        pci.purchase_order_id,
        vg.generic_name,
        vp.product_name,
        pci.qty,
        mup.qty AS small_qty,
        mu.unit_name,
        ROUND(pci.unit_price, 2) AS unit,
        ROUND(pci.total_price, 2) AS total,
        ml.labeler_name,
        ml.labeler_name_po,
        ml.address,
        pcpo.order_date,
        pcpo.chief_id,
        pcpo.buyer_id,
        pcpo.manager_id,
    CONCAT(t.title_name,p.fname,' ',p.lname) as buyer_fullname,
    CONCAT(t2.title_name,p2.fname,' ',p2.lname) as chief_fullname,
    po.position_name as buyer_position,
    po2.position_name as chief_position,
        pcpo.created_date,
        pcpo.delivery,
        pcpo.purchase_order_number,
        pcpo.purchase_order_book_number,
        lb.bid_name
    FROM
        pc_purchasing_order pcpo
        LEFT JOIN pc_purchasing_order_item pci ON pci.purchase_order_id = pcpo.purchase_order_id
        LEFT JOIN mm_generics vg ON pci.generic_id = vg.generic_id
        LEFT JOIN mm_labelers ml ON ml.labeler_id = pcpo.labeler_id
        LEFT JOIN mm_products vp ON vp.product_id = pci.product_id
        LEFT JOIN mm_unit_generics mup ON pci.unit_generic_id = mup.unit_generic_id
        LEFT JOIN mm_units mu ON mu.unit_id = mup.to_unit_id
        LEFT JOIN l_bid_type lb ON lb.bid_id = pcpo.purchase_type_id
        LEFT JOIN um_people p ON pcpo.buyer_id = p.people_id
        LEFT JOIN um_titles t ON p.title_id = t.title_id
        LEFT JOIN um_positions po ON po.position_id = p.position_id
        LEFT JOIN um_people p2 ON pcpo.chief_id = p2.people_id
        LEFT JOIN um_titles t2 ON p2.title_id = t2.title_id
        LEFT JOIN um_positions po2 ON po2.position_id = p2.position_id 
        WHERE
        pcpo.purchase_order_id = '${purchaOrderId}'`);
    }
    tPurchase(knex: Knex, createDate) {
        return knex.raw(`SELECT 
    po.created_date,
    po.purchasing_id,
    poi.purchase_order_id,
    po.created_date ,
    poi.product_id ,
    g.generic_name ,
    poi.qty ,
    poi.small_qty ,
    u.unit_name ,
    ROUND(poi.unit_price, 2) AS unit_price ,
    ROUND(poi.total_price, 2) AS total_price ,
    b.bgtype_name ,
    l.labeler_name,
    l.labeler_name_po,
    FROM
    pc_purchasing_order po 
    JOIN pc_purchasing_order_item poi ON poi.purchase_order_id = po.purchase_order_id 
    JOIN mm_labelers l ON poi.labeler_id = l.labeler_id 
    JOIN mm_generics g ON poi.generic_id = g.generic_id 
    LEFT JOIN bm_bgtype b ON b.bgtype_id = po.budgettype_id 
    LEFT JOIN mm_unit_generics uc ON uc.to_unit_id = poi.unit_generic_id
    LEFT JOIN mm_units u ON u.unit_id = uc.to_unit_id
    WHERE
    po.created_date LIKE ?`, [createDate]);
    }
    LsPurchase(knex: Knex, startdate: any, enddate: any, genericTypeId: any) {
        let sql = `SELECT
        g.generic_name,
        u.unit_name,
        pmm.min_qty,
        0 AS used,
        pmm.max_qty,
        ROUND( poi.unit_price, 2 ) AS price,
        wp.qty,
        poi.qty AS orderqty,
        mp.product_name,
        l.labeler_name,
        l.labeler_name_po
    FROM
        pc_purchasing_order po
        JOIN pc_purchasing_order_item poi ON po.purchase_order_id = poi.purchase_order_id
        JOIN mm_generics g ON g.generic_id = poi.generic_id
        LEFT JOIN mm_unit_generics ug ON ug.generic_id = poi.generic_id
        LEFT JOIN mm_units u ON u.unit_id = ug.to_unit_id
        LEFT JOIN mm_products mp ON poi.product_id = mp.product_id
        LEFT JOIN mm_labelers l ON l.labeler_id = po.labeler_id
        LEFT JOIN mm_generics pmm on pmm.generic_id = poi.generic_id
        LEFT JOIN wm_products wp ON wp.product_id = poi.product_id
    WHERE
        po.order_date BETWEEN ? 
        AND ? `;
        if (genericTypeId) {
            sql += ` AND g.generic_type_id = '${genericTypeId}'`
        }
        sql += ` GROUP BY
        g.generic_id `
        return knex.raw(sql, [startdate, enddate]);
    }

    getOrderPoint(knex: Knex, warehouseId: any, genericTypeIds: any) {
        return knex.raw(`SELECT
            (
        SELECT
            ifnull( sum( wp.qty ), 0 ) 
        FROM
            wm_products AS wp
            INNER JOIN mm_products AS mp ON mp.product_id = wp.product_id 
        WHERE
            mp.generic_id = mg.generic_id 
            AND wp.warehouse_id = ${warehouseId} 
            ) AS remain_qty,	
            mlv.labeler_name as vlabeler,
            mlm.labeler_name as mlabeler,
            mlv.labeler_name_po as vlabelerpo,
            mlm.labeler_name_po as mlabelerpo,
            mp.product_name,
            ug.qty,	
            gt.generic_type_name,
            u.unit_name AS primary_unit_name,
            mg.working_code,
            mg.generic_id,
            mg.generic_name,
            mg.min_qty,
            mg.max_qty,
            mg.unit_cost
        FROM
            mm_generics AS mg
            INNER JOIN mm_generic_types AS gt ON gt.generic_type_id = mg.generic_type_id
            INNER JOIN mm_units AS u ON u.unit_id = mg.primary_unit_id 
            INNER JOIN mm_products as mp on mp.generic_id = mg.generic_id
            INNER JOIN wm_products as wp on wp.product_id = mp.product_id
            INNER JOIN mm_unit_generics as ug on ug.unit_generic_id = wp.unit_generic_id
            INNER JOIN mm_labelers as mlv on mlv.labeler_id = mp.v_labeler_id
            INNER JOIN mm_labelers as mlm on mlm.labeler_id = mp.m_labeler_id
        WHERE
            mg.mark_deleted = "N" 
            AND mg.is_active = "Y"
            AND mg.generic_type_id = ${genericTypeIds} 
        GROUP BY wp.product_id
        HAVING
            remain_qty <= mg.min_qty 
        ORDER BY
            mlv.labeler_name ASC`)
    }

    getSelectOrderPoint(knex: Knex, warehouseId: any, product_id: any, unit_generic_id: any) {
        let sql = `SELECT
        (
    SELECT
        ifnull( sum( wp.qty ), 0 ) 
    FROM
        wm_products AS wp
        INNER JOIN mm_products AS mp ON mp.product_id = wp.product_id 
    WHERE
        mp.generic_id = mg.generic_id 
        AND wp.warehouse_id = ${warehouseId} 
        ) AS remain_qty,	
        mlv.labeler_name as vlabeler,
        mlm.labeler_name as mlabeler,
        mlv.labeler_name_po as vlabelerpo,
        mlm.labeler_name_po as mlabelerpo,
        mp.product_name,
        ug.qty,	
        gt.generic_type_name,
        u.unit_name AS primary_unit_name,
        mg.working_code,
        mg.generic_id,
        mg.generic_name,
        mg.min_qty,
        mg.max_qty,
        ug.cost as unit_cost
    FROM
        mm_generics AS mg
        LEFT JOIN mm_generic_types AS gt ON gt.generic_type_id = mg.generic_type_id
        LEFT JOIN mm_units AS u ON u.unit_id = mg.primary_unit_id 
        LEFT JOIN mm_products as mp on mp.generic_id = mg.generic_id
        LEFT JOIN wm_products as wp on wp.product_id = mp.product_id
        `;

        if (unit_generic_id === null) {
            sql += ` LEFT JOIN mm_unit_generics as ug on ug.unit_generic_id `;
        } else {
            sql += `LEFT JOIN mm_unit_generics as ug on ug.unit_generic_id = ${unit_generic_id}`;
        }
        sql += ` LEFT JOIN mm_labelers as mlv on mlv.labeler_id = mp.v_labeler_id
                LEFT JOIN mm_labelers as mlm on mlm.labeler_id = mp.m_labeler_id
                WHERE
                    mp.product_id = '${product_id}'
                GROUP BY wp.product_id
                ORDER BY
                    mlv.labeler_name ASC`;
        return knex.raw(sql)
    }

    getSelectOrderPointGeneric(knex: Knex, warehouseId: any, generic_id: any, unit_generic_id: any) {
        let sql = `SELECT
        (
    SELECT
        ifnull( sum( wp.qty ), 0 ) 
    FROM
        wm_products AS wp
        INNER JOIN mm_products AS mp ON mp.product_id = wp.product_id 
    WHERE
        mp.generic_id = mg.generic_id 
        AND wp.warehouse_id = ${warehouseId} 
        ) AS remain_qty,	
        mlv.labeler_name as vlabeler,
        mlm.labeler_name as mlabeler,
        mlv.labeler_name_po as vlabelerpo,
        mlm.labeler_name_po as mlabelerpo,
        mp.product_name,
        ug.qty,	
        gt.generic_type_name,
        u.unit_name AS primary_unit_name,
        mg.working_code,
        mg.generic_id,
        mg.generic_name,
        mg.min_qty,
        mg.max_qty,
        ug.cost as unit_cost
    FROM
        mm_generics AS mg
        LEFT JOIN mm_generic_types AS gt ON gt.generic_type_id = mg.generic_type_id
        LEFT JOIN mm_units AS u ON u.unit_id = mg.primary_unit_id 
        LEFT JOIN mm_products as mp on mp.generic_id = mg.generic_id
        LEFT JOIN wm_products as wp on wp.product_id = mp.product_id
        `;

        if (unit_generic_id === null) {
            sql += ` LEFT JOIN mm_unit_generics as ug on ug.unit_generic_id `;
        } else {
            sql += `LEFT JOIN mm_unit_generics as ug on ug.unit_generic_id = ${unit_generic_id}`;
        }
        sql += ` LEFT JOIN mm_labelers as mlv on mlv.labeler_id = mp.v_labeler_id
                LEFT JOIN mm_labelers as mlm on mlm.labeler_id = mp.m_labeler_id
                WHERE
                    mp.generic_id = '${generic_id}'
                GROUP BY wp.product_id
                ORDER BY
                    mlv.labeler_name ASC`;
        return knex.raw(sql)
    }

    getReservedOrdered(db: Knex, reserve_id) {
        let sql = db('pc_product_reserved as rv')
            .select('mg.working_code', 'mp.product_name', 'mg.generic_id', 'rv.contract_id',
                'mg.generic_name', 'rv.cost as purchase_cost', 'rv.purchase_qty as order_qty',
                'rv.unit_generic_id', 'gt.generic_type_id', 'rv.product_id', 'rv.reserve_id',
                'ut.unit_name as to_unit_name', 'uf.unit_name as from_unit_name', 'mp.v_labeler_id', 'mp.m_labeler_id',
                'ug.qty as conversion_qty', 'ml.labeler_name', 'gt.generic_type_name', 'vcpa.contract_id', 'vcpa.contract_no', 'mp.tmt_id', 'mp.std_code')
            .innerJoin('mm_products as mp', 'mp.product_id', 'rv.product_id')
            .innerJoin('mm_generics as mg', 'mg.generic_id', 'mp.generic_id')
            .innerJoin('mm_generic_types as gt', 'gt.generic_type_id', 'mg.generic_type_id')
            .innerJoin('mm_labelers as ml', 'ml.labeler_id', 'mp.v_labeler_id')
            .leftJoin('mm_unit_generics as ug', 'ug.unit_generic_id', 'rv.unit_generic_id')
            .leftJoin('mm_units as uf', 'uf.unit_id', 'ug.from_unit_id')
            .leftJoin('mm_units as ut', 'ut.unit_id', 'ug.to_unit_id')
            .leftJoin('view_cm_products_active as vcpa', 'vcpa.product_id', 'mp.product_id')
            .whereRaw('mg.mark_deleted="N"')
            .where('rv.reserved_status', 'CONFIRMED')
            .whereIn('rv.reserve_id', reserve_id)
        sql.orderBy('ml.labeler_name');
        return sql;
    }

    lPurchase(knex: Knex, startdate: any, enddate: any) {
        return knex.raw(`SELECT
        g.generic_name,
        u.unit_name,
        pmm.min_qty,
        0 AS used,
        pmm.max_qty,
        ROUND( poi.unit_price, 2 ) AS price,
        wp.qty,
        poi.qty AS orderqty,
        mp.product_name,
        l.labeler_name,
        l.labeler_name_po
    FROM
        pc_purchasing_order po
        JOIN pc_purchasing_order_item poi ON po.purchase_order_id = poi.purchase_order_id
        JOIN mm_generics g ON g.generic_id = poi.generic_id
        LEFT JOIN mm_unit_generics ug ON ug.generic_id = poi.generic_id
        LEFT JOIN mm_units u ON u.unit_id = ug.to_unit_id
        LEFT JOIN mm_products mp ON poi.product_id = mp.product_id
        LEFT JOIN mm_labelers l ON l.labeler_id = po.labeler_id
        LEFT JOIN mm_generics pmm on pmm.generic_id = poi.generic_id
        LEFT JOIN wm_products wp ON wp.product_id = poi.product_id
    WHERE
        po.order_date BETWEEN ? 
        AND ?
    GROUP BY
        g.generic_id `, [startdate, enddate]);
    }
    pPurchase(knex: Knex, startdate, enddate) {
        return knex.raw(`SELECT
    bd.name,
    COUNT(DISTINCT po.purchase_order_id) AS po,
    COUNT(po.purchase_order_id) AS list,
    ROUND(SUM(poi.total_price),2) AS cost
    FROM
    pc_purchasing_order po
    JOIN pc_purchasing_order_item poi ON poi.purchase_order_id=po.purchase_order_id
    JOIN cm_bid_process bd ON bd.id=po.purchase_method_id
    WHERE po.order_date BETWEEN ? AND ?
    GROUP BY bd.name ORDER BY bd.id`, [startdate, enddate]);
    }
    mPurchase(knex: Knex) {
        return knex.raw(`SELECT
    generic_type_id,
    drug_account_name,
    COUNT(product_id) AS 'amount'
    FROM view_all_product
    WHERE drug_account_id >= 1
    GROUP BY drug_account_id
    UNION
    SELECT
    generic_type_id,
    generic_type_name,
    COUNT(product_id) AS 'amount' 
    FROM view_all_product 
    WHERE generic_type_id != 1
    GROUP BY generic_type_name
    ORDER BY generic_type_id`);
    }
    pPurchasing(knex: Knex, startdate) {
        let _query = '%' + startdate + '%'
        return knex.raw(`SELECT
        mp.product_name,
        uc.qty AS conversion,
        u.unit_name AS primary_unit,
        poi.purchase_order_id,
        po.purchase_order_number,
        po.purchase_order_book_number,
        po.order_date,
        g.generic_name,
        poi.qty,
        uu.unit_name,
        ROUND( poi.unit_price, 2 ) AS unit_price,
        ROUND( poi.total_price, 2 ) AS total_price,
        l.labeler_name, 
        l.labeler_name_po 
    FROM
        pc_purchasing_order po
        JOIN pc_purchasing_order_item poi ON poi.purchase_order_id = po.purchase_order_id
        JOIN mm_products mp ON mp.product_id = poi.product_id
        JOIN mm_labelers l ON po.labeler_id = l.labeler_id
        JOIN mm_generics g ON poi.generic_id = g.generic_id
        LEFT JOIN bm_bgtype b ON b.bgtype_id = po.budgettype_id
        LEFT JOIN mm_unit_generics uc ON uc.unit_generic_id = poi.unit_generic_id
        LEFT JOIN mm_units u ON u.unit_id = uc.to_unit_id 
        LEFT JOIN mm_units uu ON uu.unit_id = uc.from_unit_id 
    WHERE
        po.order_date LIKE ? 
        AND po.is_cancel = 'N' 
    GROUP BY
        poi.product_id,purchase_order_id 
    ORDER BY
        po.purchase_order_number`, [_query]);
    }

    PurchasingList(knex: Knex, startdate, enddate, generic_type_id) {
        return knex.raw(`SELECT
        mp.product_name,
        uc.qty AS conversion,
        u.unit_name AS primary_unit,
        poi.purchase_order_id,
        po.purchase_order_number,
        po.purchase_order_book_number,
        po.order_date,
        g.generic_name,
        poi.qty,
        uu.unit_name,
        ROUND( poi.unit_price, 2 ) AS unit_price,
        ROUND( poi.total_price, 2 ) AS total_price,
        l.labeler_name, 
        l.labeler_name_po,
        r.delivery_date,
        r.delivery_code
    FROM
        pc_purchasing_order po
        JOIN pc_purchasing_order_item poi ON poi.purchase_order_id = po.purchase_order_id
        JOIN mm_products mp ON mp.product_id = poi.product_id
        JOIN mm_labelers l ON po.labeler_id = l.labeler_id
        JOIN mm_generics g ON poi.generic_id = g.generic_id
        LEFT JOIN bm_bgtype b ON b.bgtype_id = po.budgettype_id
        LEFT JOIN mm_unit_generics uc ON uc.unit_generic_id = poi.unit_generic_id
        LEFT JOIN mm_units u ON u.unit_id = uc.to_unit_id
        LEFT JOIN mm_units uu ON uu.unit_id = uc.from_unit_id 
        LEFT JOIN wm_receives r on po.purchase_order_id = r.purchase_order_id
    WHERE
        po.order_date BETWEEN '${startdate}' 
        AND '${enddate}' 
        AND po.is_cancel = 'N' 
        AND g.generic_type_id = ${generic_type_id}
    GROUP BY
        purchase_order_id,poi.product_id
    ORDER BY
        po.purchase_order_number`);
    }

    Purchasing(knex: Knex, startdate: any, enddate: any, type: any, status: any) {
        status = `%` + status + `%`;
        return knex.raw(`SELECT
        uc.qty AS conversion,
        u.unit_name AS primary_unit,
        poi.purchase_order_id,
        po.purchase_order_number,
        po.purchase_order_book_number,
        po.order_date,
        g.generic_name,
        uc.qty * poi.qty AS qty,
        muu.unit_name,
        ROUND( poi.unit_price, 2 ) AS unit_price,
        ROUND( poi.total_price, 2 ) AS total_price,
        l.labeler_name, 
        l.labeler_name_po  
    FROM
        pc_purchasing_order po
        JOIN pc_purchasing_order_item poi ON poi.purchase_order_id = po.purchase_order_id
        JOIN mm_labelers l ON po.labeler_id = l.labeler_id
        JOIN mm_generics g ON poi.generic_id = g.generic_id
        LEFT JOIN bm_bgtype b ON b.bgtype_id = po.budgettype_id
        LEFT JOIN mm_unit_generics uc ON uc.unit_generic_id = poi.unit_generic_id
        LEFT JOIN mm_units u ON u.unit_id = uc.to_unit_id
        LEFT JOIN mm_units muu ON u.unit_id = uc.from_unit_id	
    WHERE
        po.order_date BETWEEN ? and ? and po.budget_detail_id = ? and purchase_order_status LIKE ?
        AND po.is_cancel = 'N'
    GROUP BY
        poi.product_id,purchase_order_id 
    ORDER BY
        po.purchase_order_number`, [startdate, enddate, type, status]);
    }
    name(knex: Knex, purchaRequisId) {
        let sql = `SELECT
        up.fname,
        up.lname,
        pcp.position_name,
        us.position_name as p
        FROM
        pc_purchasing_requisition_item ppri
        JOIN pc_purchasing_requisition ppr ON ppri.requisition_id = ppr.requisition_id
        JOIN mm_labelers ml ON ppr.labeler_id = ml.labeler_id
        JOIN view_generics vg ON vg.generic_id = ppri.generic_id
        JOIN bm_bgtype bb ON ppr.budgettype_id = bb.bgtype_id
        JOIN pc_committee_people pcp ON pcp.committee_id = ppr.verify_committee_id
        JOIN um_people up ON up.people_id = pcp.people_id
        JOIN um_positions us ON up.position_id=us.position_id
        WHERE ppr.requisition_id = ?
        GROUP BY pcp.people_id
        ORDER BY pcp.position_name DESC`;
        return knex.raw(sql, purchaRequisId);
    }

    async bidName(knex: Knex, id: any) {
        return knex('l_bid_process')
            .where('id', id)
    }

    async purchasing(knex: Knex, purchaOrderId) {
        return knex('pc_purchasing_order').where('purchase_order_id', purchaOrderId);
    }

    purchasingCountItem(knex: Knex, purchaOrderId) {
        let sql = `select count(poi.purchase_order_item_id) as count from pc_purchasing_order po
    join pc_purchasing_order_item poi on po.purchase_order_id=poi.purchase_order_id where po.purchase_order_id= ? `;
        return knex.raw(sql, purchaOrderId);
    }

    CountItem(knex: Knex, purchaOrderId) {
        return knex('pc_purchasing_order as po')
            .select(knex.raw('count(poi.purchase_order_item_id) as count'))
            .join('pc_purchasing_order_item as poi', 'po.purchase_order_id', 'poi.purchase_order_id')
            .where('po.purchase_order_id', purchaOrderId);
    }

    comma(num) {
        var number = +num
        num = number.toFixed(2);
        let deci = num.substr(num.length - 2, num.length);
        num = num.substr(0, num.length - 3);

        var l = num.toString().length
        var num2 = '';
        var c = 0;
        for (var i = l - 1; i >= 0; i--) {
            c++;
            if (c == 3 && num[i - 1] != null) { c = 0; num2 = ',' + num[i] + num2 }
            else num2 = num[i] + num2
        }
        return num2 + '.' + deci;

    }
    commaQty(num) {
        num = '' + num;
        var l = num.toString().length
        var num2 = '';
        var c = 0;
        for (var i = l - 1; i >= 0; i--) {
            c++;
            if (c == 3 && num[i - 1] != null) { c = 0; num2 = ',' + num[i] + num2 }
            else num2 = num[i] + num2
        }
        return num2;

    }
    bahtText(num) {
        var number = +num
        num = '' + number.toFixed(2);
        let deci = num.substr(num.length - 2, 2);
        num = num.substr(0, num.length - 3);
        //สร้างอะเรย์เก็บค่าที่ต้องการใช้เอาไว้
        var TxtNumArr = new Array("ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า", "สิบ");
        var TxtDigitArr = new Array("", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน");
        var BahtText = "";
        //ตรวจสอบดูซะหน่อยว่าใช่ตัวเลขที่ถูกต้องหรือเปล่า ด้วย isNaN == true ถ้าเป็นข้อความ == false ถ้าเป็นตัวเลข
        // num='5671';
        var num2 = num;
        var lnum = num.length;
        var cm = 0;
        num = "";
        for (var i = lnum - 1; i >= 0; i--) {
            num += num2[i];
        }
        if (lnum > 7) {
            for (var i = lnum - 1; i >= 0; i--) {

                if (i < 6) { i = -1; BahtText += TxtDigitArr[6]; cm = 1 }
                else if (num[i] == 0) {
                    if (num[i + 1] == 1 && num[i] == 0 && i == 6) { BahtText += TxtDigitArr[6]; }
                }
                else if (num[8] == 1 && num[7] == 0 && num[6] == 1 && i == 6) {
                    BahtText += TxtNumArr[1] + TxtDigitArr[6];
                    cm = 1;
                }
                else if (i == 7 && num[i] == 2) {
                    BahtText += 'ยี่' + TxtDigitArr[i - 6]
                }
                else if (i == 6 && num[i] == 1) {
                    BahtText += 'เอ็ด'
                }
                else if (i == 7 && num[i] == 1) {
                    BahtText += TxtDigitArr[i - 6];
                    cm = 1;
                }
                else
                    BahtText += TxtNumArr[num[i]] + TxtDigitArr[i - 6]
            }
        }
        var c = 1;
        for (var i = lnum - 1; i >= 0; i--) {
            if (lnum > 7 && c == 1) { i = 6; c = 0; }
            if (lnum > 7 && cm == 1) { i = 5; cm = 0 }
            if (num[i] == 0) { }
            else if (i == 1 && num[i] == 1) {
                BahtText += TxtDigitArr[i];
            }
            else if (i == 1 && num[i] == 2) {
                BahtText += 'ยี่' + TxtDigitArr[i]
            }
            else if (lnum == 1 && num[0] == 1) {
                BahtText += TxtNumArr[num[i]] + TxtDigitArr[i]
            }
            else if (i == 0 && num[i] == 1 && num[1] != 0) {
                BahtText += 'เอ็ด'
            }
            else
                BahtText += TxtNumArr[num[i]] + TxtDigitArr[i]
        }
        if (num == 0) BahtText += 'ศูนย์';
        if (deci == '0' || deci == '00') {
            BahtText += 'บาทถ้วน';
        } else {
            var deci2 = deci;
            lnum = deci.length;
            deci = '';
            for (var i = lnum - 1; i >= 0; i--) {
                deci += deci2[i];
            }
            BahtText += 'บาท';
            for (var i = lnum - 1; i >= 0; i--) {
                if (deci[i] == 0) { }
                else if (i == 1 && deci[i] == 1) {
                    BahtText += TxtDigitArr[i];
                }
                else if (i == 1 && deci[i] == 2) {
                    BahtText += 'ยี่' + TxtDigitArr[i]
                }
                // else if(1==1&&deci[0]==1){
                //     BahtText+=TxtNumArr[deci[i]]+TxtDigitArr[i]
                // }
                else if (i == 0 && deci[i] == 1 && deci[1] != 0) {
                    BahtText += 'เอ็ด'
                }
                else
                    BahtText += TxtNumArr[deci[i]] + TxtDigitArr[i]

            }
            BahtText += 'สตางค์';

        }
        return BahtText;
    }

    async getPurchasingOfficer(knex: Knex) {
        return knex('view_purchasing_officer')
    }

    async getUser(knex: Knex, userId: number) {
        return knex('view_peoples')
            .select('view_peoples.*', 'pu.user_id')
            .innerJoin('um_people_users', 'um_people_users.people_id', 'view_peoples.people_id')
            .where('pu.user_id', userId)
    }

    async getCommitteeVerify(knex: Knex, committee_id: string) {
        return knex('view_peoples')
            .select('view_peoples.*', knex.raw('concat(title_name,fname," ",lname) as fullname'), 'pc_committee_people.position_name as position')
            .innerJoin('pc_committee_people', 'pc_committee_people.people_id', 'view_peoples.people_id')
            .innerJoin('pc_committee', 'pc_committee.committee_id', 'pc_committee_people.committee_id')
            .where('pc_committee.committee_id', committee_id)
            .orderBy('pc_committee_people.position_name', 'desc')
    }


    purchasingCommittee(knex: Knex, committeeId) {
        return knex('pc_committee as pc')
            .select(
                'pc.committee_id',
                'pcp.people_id',
                'ut.title_name',
                'p.fname',
                'p.lname',
                'up.position_name',
                'pcp.position_name AS position',
                knex.raw(`concat(
                    ut.title_name,
                    p.fname,
                    " ",
                    p.lname
                ) AS fullname`
                ))
            .join('pc_committee_people as pcp', 'pc.committee_id', 'pcp.committee_id')
            .join('um_people as p', 'p.people_id', 'pcp.people_id')
            .join('um_titles as ut', 'ut.title_id', 'p.title_id')
            .joinRaw(`left join um_people_positions upp on p.people_id = upp.people_id and upp.is_actived='Y'`)
            .leftJoin('um_positions as up', 'up.position_id', 'upp.position_id')
            .orderBy('pcp.committee_people_id')
            .where('pc.committee_id', committeeId)
    }
    purchasingCommittee2(knex: Knex, purchaOrderId) {
        let sql = `
            SELECT
            pc.committee_id,
            pcp.people_id,
            ut.title_name,
            p.fname,
            p.lname,
            up.position_name,
            pcp.position_name AS position,
            concat(
                ut.title_name,
                p.fname,
                " ",
                p.lname
            ) AS fullname
        FROM
            pc_purchasing_order po
        LEFT JOIN pc_committee pc ON po.verify_committee_id = pc.committee_id
        LEFT JOIN pc_committee_people pcp ON pc.committee_id = pcp.committee_id
        LEFT JOIN um_people p ON p.people_id = pcp.people_id
        LEFT JOIN um_titles ut ON ut.title_id = p.title_id
        left join um_people_positions upp on p.people_id = upp.people_id and upp.is_actived='Y'
        LEFT JOIN um_positions up ON up.position_id = upp.position_id
        WHERE
            po.purchase_order_id = ?
        ORDER BY
        pcp.committee_people_id`;
        return knex.raw(sql, purchaOrderId);
    }

    purchasingCommitteeCheck(knex: Knex, purchaOrderId) {
        let sql = `SELECT
    pc.committee_id,
    pcp.people_id,
    pcp.position_name,
    ut.title_name,
    p.fname,
    p.lname,
    up.position_name as position2
    FROM
        pc_purchasing_order po
    JOIN pc_committee pc ON po.check_price_committee_id = pc.committee_id
    JOIN pc_committee_people pcp ON pc.committee_id = pcp.committee_id
    JOIN um_people p ON p.people_id = pcp.people_id
    JOIN um_titles ut ON ut.title_id = p.title_id
    JOIN um_positions up ON up.position_id = p.people_id
    WHERE
        po.purchase_order_id = ? 
        ORDER BY p.position_id asc`;
        return knex.raw(sql, purchaOrderId);
    }

    // getChief(knex: Knex, typeId) {
    //     //ดึงหัวหน้าเจ้าหน้าที่พัสดุ ส่ง 4 เข้ามา
    //     return knex.select('t.title_name as title', 'p.fname', 'p.lname', 'upos.position_name', 'upot.type_name as position')
    //         .from('um_purchasing_officer as upo')
    //         .join('um_people as p', 'upo.people_id', 'p.people_id')
    //         .join('um_titles as t', 't.title_id', 'p.title_id')
    //         .join('um_positions as upos', 'upos.position_id', 'p.position_id')
    //         .join('um_purchasing_officer_type as upot', 'upot.type_id', 'upo.type_id')
    //         .where('upo.type_id', typeId)
    //         .where('upo.isactive', '1')
    // }


    getStaff(knex: Knex, officerId) {
        return knex.select('t.title_name as title', 'p.fname', 'p.lname', knex.raw(`concat(t.title_name,p.fname,' ',p.lname) as fullname`), 'upos.position_name', 'upo.type_name as position')
            .from('um_purchasing_officer as upo')
            .join('um_people as p', 'upo.people_id', 'p.people_id')
            .join('um_titles as t', 't.title_id', 'p.title_id')
            .joinRaw(`left join um_people_positions upp on p.people_id = upp.people_id and upp.is_actived='Y'`)
            .leftJoin('um_positions as upos', 'upos.position_id', 'upp.position_id')
            .where('upo.officer_id', officerId)
    }

    purchasing2Chief(knex: Knex, purchaOrderId) {
        return knex.select('po.chief_id', 'po.buyer_id', knex.raw('concat(tiy.title_name,pey.fname," ",pey.lname) as buyer_fullname'), 'psy.position_name as buyer_position', knex.raw('concat(tic.title_name,pec.fname," ",pec.lname) as chief_fullname'), 'psc.position_name as chief_position')
            .from('pc_purchasing_order as po')
            .leftJoin('um_people as pey', 'po.buyer_id', 'pey.people_id')
            .leftJoin('um_titles as tiy', 'pey.title_id', 'tiy.title_id')
            .leftJoin('um_positions as psy', 'psy.position_id', 'pey.position_id')
            .leftJoin('um_people as pec', 'po.chief_id', 'pec.people_id')
            .leftJoin('um_titles as tic', 'pec.title_id', 'tic.title_id')
            .joinRaw(`left join um_people_positions upp on pey.people_id = upp.people_id and upp.is_actived='Y'`)
            .leftJoin('um_positions as psc', 'psc.position_id', 'upp.position_id')
            .where('po.purchase_order_id', purchaOrderId)
    }
    getPosition(knex: Knex, id: any) {
        return knex('um_people as up')
            .leftJoin('um_positions as upp', 'upp.position_id', 'up.position_id')
            .leftJoin('um_titles as ut', 'ut.title_id', 'up.title_id')
            .where('up.people_id', id)
    }
    purchasing3(knex: Knex, purchaOrderId) {
        let sql = `SELECT 
        po.purchase_order_id,
        cbp.name,
        ml.labeler_name,
        ml.labeler_name_po,
        g.generic_id,
        g.generic_name,
        SUM(wp.qty) AS qty,
        poi.qty AS qtyPoi,
        poi.unit_price,
        poi.total_price,
        u.unit_name,
        po.verify_committee_id,
        po.check_price_committee_id
        FROM pc_purchasing_order po
        JOIN pc_purchasing_order_item poi ON poi.purchase_order_id=po.purchase_order_id
        JOIN mm_generics g ON poi.generic_id=g.generic_id
        LEFT JOIN mm_unit_generics ug ON g.generic_id=ug.generic_id
        LEFT JOIN mm_units u ON ug.to_unit_id=u.unit_id
        LEFT JOIN wm_products wp ON wp.product_id=poi.product_id
        LEFT JOIN mm_labelers ml ON ml.labeler_id=po.labeler_id
        LEFT JOIN l_bid_process cbp ON cbp.id=po.purchase_method_id
        WHERE po.purchase_order_id=?
        GROUP BY g.generic_id,poi.purchase_order_item_id`;
        return knex.raw(sql, purchaOrderId);
    }
    purchasing4(knex: Knex, purchaOrderId) {
        return knex.select().from('pc_purchasing_order as po')
            .join('pc_purchasing_order_item as poi', 'po.purchase_order_id', 'poi.purchase_order_id')
            .join('mm_products as mp', 'mp.product_id', 'poi.product_id')
            .join('mm_labelers as ml', 'ml.labeler_id', 'po.labeler_id')
            .where('po.purchase_order_id', purchaOrderId)
    }
    purchasing5(knex: Knex, purchaOrderId) {
        return knex.select().from('pc_purchasing_order as po')
            .join('pc_purchasing_order_item as poi', 'po.purchase_order_id', 'poi.purchase_order_id')
            .join('mm_products as mp', 'mp.product_id', 'poi.product_id')
            .join('mm_labelers as ml', 'ml.labeler_id', 'po.labeler_id')
            .where('po.purchase_order_id', purchaOrderId)
    }
    purchasing8(knex: Knex, purchaOrderId) {
        return knex.select().from('pc_purchasing_order as po')
            .join('pc_purchasing_order_item as poi', 'po.purchase_order_id', 'poi.purchase_order_id')
            .join('mm_products as mp', 'mp.product_id', 'poi.product_id')
            .join('mm_labelers as ml', 'ml.labeler_id', 'po.labeler_id')
            .where('po.purchase_order_id', purchaOrderId)
    }
    purchasing9(knex: Knex, startdate, enddate) {
        return knex.raw(`SELECT
    po.purchase_order_id,
    poi.generic_id,
    vp.product_name,
    vp.generic_name,
    ROUND(poi.unit_price,2) AS unit_price,
    poi.qty,
    mup.qty as qty1,
    mu.unit_name,
    ROUND(poi.total_price,2) AS total_price,
    ml.labeler_name,
    ml.labeler_name_po
    FROM pc_purchasing_order po
    JOIN pc_purchasing_order_item poi ON po.purchase_order_id=poi.purchase_order_id
    JOIN view_products vp ON vp.generic_id=poi.generic_id
    JOIN mm_labelers ml ON ml.labeler_id=po.labeler_id
    JOIN mm_unit_products mup ON mup.unit_product_id=poi.unit_product_id
    JOIN mm_units mu ON mu.unit_id=mup.to_unit_id
    WHERE po.created_date BETWEEN ? AND ? ORDER BY po.created_date`, [startdate, enddate]);
    }
    purchasing10(knex: Knex, purchaOrderId, warehouseId: any) {
        let sql = `SELECT
        IF
            (
                ( SELECT standard_cost FROM mm_unit_generics WHERE unit_generic_id = poi.unit_generic_id ) = 0,
                mg.standard_cost,
                ( SELECT standard_cost FROM mm_unit_generics WHERE unit_generic_id = poi.unit_generic_id ) 
            ) AS standard_cost,
            mup.cost,
            mp.product_name,
            mup.qty AS conversion,
            muu.unit_name AS primary_unit,
            po.delivery,
            ml.address,
            ml.phone,
            ml.nin,
            po.purchase_order_id,
            po.purchase_order_number,
            po.purchase_method_id,
            po.purchase_order_book_number,
            cbp.NAME AS bname,
            cbt.bid_name,
            cbt.bid_id,
            ml.labeler_name,
            ml.labeler_name_po,
            mg.generic_id,
            mg.generic_name,
            IFNULL(
                (
            SELECT
                FLOOR(
                ( IF ( SUM( wp.qty ) IS NULL, 0, SUM( wp.qty ) ) ) / mup.qty
                ) 
            FROM
                wm_products wp 
            JOIN mm_products AS mmp on mmp.product_id = wp.product_id
            WHERE
                mg.generic_id = mmp.generic_id
                AND wp.warehouse_id = ${warehouseId} 
                ),
                0 
                ) AS qty,
            poi.qty AS qtyPoi,
            poi.unit_price,
            poi.total_price,
            mu.unit_name,
            po.verify_committee_id,
            po.check_price_committee_id,
            po.budget_detail_id,
            po.order_date,
            po.vat,
            po.sub_total,
            po.total_price as net_total,
            po.include_vat,
            po.exclude_vat,
            po.buyer_id,
            po.chief_id,
            po.manager_id
        FROM
            pc_purchasing_order po
            LEFT JOIN pc_purchasing_order_item poi ON poi.purchase_order_id = po.purchase_order_id
            LEFT JOIN mm_products mp ON mp.product_id = poi.product_id
            LEFT JOIN mm_generics mg ON mp.generic_id = mg.generic_id
            LEFT JOIN mm_unit_generics mup ON mup.unit_generic_id = poi.unit_generic_id
            LEFT JOIN mm_units muu ON muu.unit_id = mg.primary_unit_id
            LEFT JOIN mm_units mu ON mu.unit_id = mup.from_unit_id
            LEFT JOIN mm_labelers ml ON ml.labeler_id = po.labeler_id
            LEFT JOIN l_bid_process cbp ON cbp.id = po.purchase_method_id
            LEFT JOIN l_bid_type cbt ON cbt.bid_id = po.purchase_type_id 
        WHERE
        po.purchase_order_id = ? 
        AND mg.generic_id IS NOT NULL`
        return knex.raw(sql, purchaOrderId)
    }

    purchasingHeader(knex: Knex, purchasingOrderId) {
        return knex('pc_purchasing_order as po')
            .select(
                'po.purchase_order_id',
                'po.purchase_order_number',
                'po.purchase_method_id',
                'po.purchase_order_book_number',
                'po.include_vat',
                'po.exclude_vat',
                'po.sub_total',
                'po.vat_rate',
                'po.total_price',
                'po.vat',
                'po.delivery',
                'po.verify_committee_id',
                'po.check_price_committee_id',
                'po.budget_detail_id',
                'po.order_date',
                'po.chief_id',
                'po.buyer_id',
                'po.manager_id',
                'vb.amount as budget_amount',
                'vb.bgtype_name as budget_type_name',
                'vb.bgtypesub_name as budget_type_sub_name',
                'vb.bg_year as budget_year',
                'cbp.name AS bid_process_name',
                'cbt.bid_name as bid_type_name',
                'cbt.bid_id as bid_type_id',
                'ml.address as labeler_address',
                'ml.phone as labeler_phone',
                'ml.nin as labeler_nin',
                'ml.labeler_name',
                'ml.labeler_name_po',
                'ml.zipcode as labeler_zipcode',
                'lm.tambon_name as labeler_tambon_name',
                'la.ampur_name as labeler_ampur_name',
                'lp.province_name as labeler_province_name',
                'lp.province_code as labeler_province_code',
                'bt.balance as transection_balance'
            )
            .leftJoin('mm_labelers as ml', 'ml.labeler_id', 'po.labeler_id')
            .leftJoin(knex.raw('l_tambon as lm on lm.tambon_code = ml.tambon_code and lm.ampur_code = ml.ampur_code and lm.province_code = ml.province_code'))
            .leftJoin(knex.raw('l_ampur as la on la.ampur_code = ml.ampur_code and la.province_code = ml.province_code'))
            .leftJoin(knex.raw('l_province as lp on lp.province_code = ml.province_code'))
            .leftJoin('l_bid_process as cbp', 'cbp.id', 'po.purchase_method_id')
            .leftJoin('l_bid_type as cbt', 'cbt.bid_id', 'po.purchase_type_id')
            .leftJoin('view_budget_subtype as vb', 'vb.bgdetail_id', 'po.budget_detail_id')
            .joinRaw(`left join pc_budget_transection as bt on bt.purchase_order_id = po.purchase_order_id and transaction_status='spend'`)
            .whereIn('po.purchase_order_id', purchasingOrderId)
            .andWhere('po.is_cancel', 'N');
    }

    purchasingEgp(knex: Knex, porder: any, warehouseId: any) {
        return knex('pc_purchasing_order as po')
            .select(
                'mup.cost',
                'mp.product_name',
                'mup.qty AS conversion',
                'muu.unit_name AS primary_unit',
                'ml.address',
                'ml.phone',
                'ml.nin',
                'poi.purchase_order_item_id',
                'cbp.NAME AS bname',
                'cbt.bid_name',
                'cbt.bid_id',
                'ml.labeler_name',
                'ml.labeler_name_po',
                'ml.zipcode',
                'lm.tambon_name',
                'la.ampur_name',
                'lp.province_name',
                'lp.province_code',
                'mg.generic_id',
                'mg.generic_name',
                knex.raw(`IF
                (
                    ( SELECT standard_cost FROM mm_unit_generics WHERE unit_generic_id = poi.unit_generic_id ) = 0,
                    mg.standard_cost,
                    ( SELECT standard_cost FROM mm_unit_generics WHERE unit_generic_id = poi.unit_generic_id ) 
                ) AS standard_cost`),
                knex.raw(`IFNULL(
                    (
                SELECT
                    FLOOR(
                    ( IF ( SUM( wp.qty ) IS NULL, 0, SUM( wp.qty ) ) ) / mup.qty
                    ) 
                FROM
                    wm_products wp 
                JOIN mm_products AS mmp on mmp.product_id = wp.product_id
                WHERE
                    mg.generic_id = mmp.generic_id
                    AND wp.warehouse_id = ${warehouseId} 
                    ),
                    0 
                    ) AS balance_qty`),
                'poi.qty AS qty',
                'poi.unit_price',
                'poi.total_price AS total_price_item',
                'poi.giveaway',
                'mu.unit_name',
                'mup.standard_cost')
            .leftJoin(' pc_purchasing_order_item as poi', 'poi.purchase_order_id', 'po.purchase_order_id')
            .leftJoin('mm_products as mp', 'mp.product_id', 'poi.product_id')
            .leftJoin('mm_generics as mg', 'mp.generic_id', 'mg.generic_id')
            .leftJoin('mm_unit_generics as mup', 'mup.unit_generic_id', 'poi.unit_generic_id')
            .leftJoin('mm_units as muu', 'muu.unit_id', 'mg.primary_unit_id')
            .leftJoin('mm_units as mu', 'mu.unit_id', 'mup.from_unit_id')
            .leftJoin('mm_labelers as ml', 'ml.labeler_id', 'po.labeler_id')
            .leftJoin(knex.raw('l_tambon as lm on lm.tambon_code = ml.tambon_code and lm.ampur_code = ml.ampur_code and lm.province_code = ml.province_code'))
            .leftJoin(knex.raw('l_ampur as la on la.ampur_code = ml.ampur_code and la.province_code = ml.province_code'))
            .leftJoin(knex.raw('l_province as lp on lp.province_code = ml.province_code'))
            .leftJoin('l_bid_process as cbp', 'cbp.id', 'po.purchase_method_id')
            .leftJoin('l_bid_type as cbt', 'cbt.bid_id', 'po.purchase_type_id')
            .where('po.purchase_order_id', porder)
            .andWhereRaw('mg.generic_id IS NOT NULL')
    }

    p10Committeeleader(knex: Knex) {
        let sql = `SELECT
            pc.committee_id,
            pcp.people_id,
            pcp.position_name,
            ut.title_name,
            p.fname,
            p.lname,
            up.position_name AS position2
        FROM
            pc_purchasing_order po
        JOIN pc_committee pc ON po.verify_committee_id = pc.committee_id
        JOIN pc_committee_people pcp ON pc.committee_id = pcp.committee_id
        JOIN um_people p ON p.people_id = pcp.people_id
        JOIN um_titles ut ON ut.title_id = p.title_id
        JOIN um_positions up ON up.position_id = p.people_id
        WHERE pcp.position_name='ประธาน'
        GROUP BY p.fname
        ORDER BY pcp.position_name
        LIMIT 1`;
        return knex.raw(sql);
    }
    p10Committee(knex: Knex) {
        let sql = `SELECT
            pc.committee_id,
            pcp.people_id,
            pcp.position_name,
            ut.title_name,
            p.fname,
            p.lname,
            up.position_name AS position2
        FROM
            pc_purchasing_order po
        JOIN pc_committee pc ON po.verify_committee_id = pc.committee_id
        JOIN pc_committee_people pcp ON pc.committee_id = pcp.committee_id
        JOIN um_people p ON p.people_id = pcp.people_id
        JOIN um_titles ut ON ut.title_id = p.title_id
        JOIN um_positions up ON up.position_id = p.people_id
        WHERE pcp.position_name='กรรมการ'
        GROUP BY p.fname
        ORDER BY pcp.position_name
        LIMIT 2`;
        return knex.raw(sql);
    }
    purchasing11(knex: Knex, startdate: any, enddate: any) {
        return knex('pc_purchasing_order')
            .select('purchase_order_id')
            .whereBetween('order_date', [startdate, enddate])
    }
    getSumTotal(knex: Knex, bgdetail: any) {
        let sql = `SELECT
        sum(total_price) as sum
        FROM
        pc_purchasing_order po
        left JOIN bm_budget_detail bd ON bd.bgdetail_id=po.budget_detail_id
        WHERE bd.bgdetail_id=?`
        return knex.raw(sql, [bgdetail]);
    }
    sumType1(knex: Knex, smonth: any, emonth: any) {
        let sql = `SELECT
        mga.account_name,
        IF(po.order_date BETWEEN ? AND ?,SUM(poi.total_price),0) AS total_price
        FROM pc_purchasing_order po 
        JOIN pc_purchasing_order_item poi ON po.purchase_order_id=poi.purchase_order_id
        JOIN mm_generics mg ON mg.generic_id=poi.generic_id
        JOIN mm_generic_accounts mga ON mga.account_id=mg.account_id
        GROUP BY mga.account_id
        ORDER BY mga.account_id
        `
        return knex.raw(sql, [smonth, emonth])
    }
    sumType2(knex: Knex, smonth: any, emonth) {
        let sql = `SELECT
        mgt.generic_type_name,
        IF(po.order_date BETWEEN ? AND ?,SUM(poi.total_price),0) AS total_price
        FROM mm_generic_types mgt
        LEFT JOIN mm_generics mg ON mgt.generic_type_id=mg.generic_type_id
        LEFT JOIN pc_purchasing_order_item poi ON mg.generic_id=poi.generic_id
        LEFT JOIN pc_purchasing_order po ON po.purchase_order_id=poi.purchase_order_id
        WHERE mgt.generic_type_id != 1
        GROUP BY mgt.generic_type_id
        ORDER BY mgt.generic_type_id
        `
        return knex.raw(sql, [smonth, emonth])
    }

    pcBudget(knex: Knex, purchaOrderId) {
        return knex('pc_budget_transection')
            .whereIn('purchase_order_id', [purchaOrderId])
            .andWhere('transaction_status', 'spend')
    }

    getProductHistory(knex: Knex, generic_id: string) {
        let sql = `SELECT
        mg.working_code AS generic_code,
	    mg.generic_name,
        po.purchase_order_number,
        mp.working_code AS trading_code,
        mp.product_name,
        pp.qty,
        mu.unit_name AS large_unit_name,
        mug.qty AS conversion_qty,
        mmu.unit_name AS small_large_unit_name,
        pp.unit_price,
        pp.total_price,
        po.contract_id
      FROM
        mm_generics AS mg
      JOIN pc_purchasing_order_item AS pp ON mg.generic_id = pp.generic_id
      JOIN pc_purchasing_order AS po ON pp.purchase_order_id = po.purchase_order_id
      JOIN mm_products AS mp ON pp.product_id = mp.product_id
      JOIN mm_unit_generics AS mug ON pp.unit_generic_id = mug.unit_generic_id
      JOIN mm_units AS mu ON mug.from_unit_id = mu.unit_id
      JOIN mm_units AS mmu ON mug.to_unit_id = mmu.unit_id
      WHERE
        pp.generic_id = '${generic_id}'
      AND
        pp.giveaway = 'N'
        `
        return (knex.raw(sql))
    }
    allAmountTransaction(knex: Knex, bgdetail_id: any, budgetYear: any, pid: any) {
        let sql = `SELECT SUM( pbt.amount ) AS amount FROM pc_budget_transection AS pbt
        LEFT JOIN bm_budget_detail AS bbd ON bbd.bgdetail_id = pbt.bgdetail_id
        LEFT JOIN pc_purchasing_order AS po ON po.purchase_order_id = pbt.purchase_order_id 
        WHERE
            pbt.bgdetail_id = ${bgdetail_id}
            AND bbd.bg_year = ${budgetYear} 
            AND pbt.transaction_status = 'SPEND' 
            AND pbt.transection_id < (
        SELECT
            t.transection_id 
        FROM
            pc_budget_transection t
            JOIN pc_purchasing_order p ON p.purchase_order_id = t.purchase_order_id
            JOIN bm_budget_detail b ON b.bgdetail_id = t.bgdetail_id 
        WHERE
            t.bgdetail_id = ${bgdetail_id}
            AND b.bg_year = ${budgetYear} 
            AND t.transaction_status = 'SPEND' 
            AND t.purchase_order_id = ${pid} 
            AND t.amount > 0
        )`;
        return knex.raw(sql)
    }

    getHudgetHistory(knex: Knex, startDate: any, endDate: any, budgetDetailId: any) {
        let sql = `SELECT
        bt.transection_id,
        bt.bgdetail_id,
        po.purchase_order_number,
        po.purchase_order_book_number,
        bt.incoming_balance,
        bt.amount,
        bt.balance,
        bt.date_time,
        bt.remark
    FROM
        pc_budget_transection as bt
        JOIN pc_purchasing_order as po ON po.purchase_order_id = bt.purchase_order_id
        WHERE bt.transaction_status = 'SPEND'
        AND bt.bgdetail_id = '${budgetDetailId}'
        AND bt.date_time BETWEEN '${startDate}' AND '${endDate}'
        ORDER BY 
		    bt.date_time`
        return knex.raw(sql)
    }

    PurchasingListByPO(knex: Knex, Sid, Eid, generic_type_id) {
        return knex.raw(`SELECT
        mp.product_name,
        uc.qty AS conversion,
        u.unit_name AS primary_unit,
        poi.purchase_order_id,
        po.purchase_order_number,
        po.purchase_order_book_number,
        po.order_date,
        g.generic_name,
        poi.qty,
        uu.unit_name,
        ROUND( poi.unit_price, 2 ) AS unit_price,
        ROUND( SUM(poi.total_price), 2 ) AS total_price,
        l.labeler_name, 
        l.labeler_name_po,
        r.delivery_date,
        r.delivery_code
    FROM
        pc_purchasing_order po
        JOIN pc_purchasing_order_item poi ON poi.purchase_order_id = po.purchase_order_id
        JOIN mm_products mp ON mp.product_id = poi.product_id
        JOIN mm_labelers l ON po.labeler_id = l.labeler_id
        JOIN mm_generics g ON poi.generic_id = g.generic_id
        LEFT JOIN bm_bgtype b ON b.bgtype_id = po.budgettype_id
        LEFT JOIN mm_unit_generics uc ON uc.unit_generic_id = poi.unit_generic_id
        LEFT JOIN mm_units u ON u.unit_id = uc.to_unit_id
        LEFT JOIN mm_units uu ON uu.unit_id = uc.from_unit_id 
        LEFT JOIN wm_receives r on po.purchase_order_id = r.purchase_order_id
    WHERE
        po.purchase_order_number BETWEEN '${Sid}' 
        AND '${Eid}' 
        AND po.is_cancel = 'N' 
        AND g.generic_type_id = ${generic_type_id}
    GROUP BY
        purchase_order_id,poi.product_id
    ORDER BY
        po.purchase_order_number`);
    }

    getWarehosue(db: Knex, warehouseId: any) {
        return db('wm_warehouses')
            .select('warehouse_name')
            .where('warehouse_id', warehouseId);
    }

    checkCancelPo(knex: Knex, purchaOrderId) {
        return knex('pc_purchasing_order')
            .whereIn('purchase_order_id', purchaOrderId)
            .andWhere('is_cancel', 'N')
    }

    getRemainStock(knex: Knex, purchaseOrderItemId) {
        return knex('pc_purchasing_order as po')
            .select('vs.balance_qty', 'mug.qty')
            .join('pc_purchasing_order_item as poi', 'poi.purchase_order_id', 'po.purchase_order_id')
            .join('view_stock_card_warehouse as vs', 'vs.product_id', 'poi.product_id')
            .join('mm_unit_generics as mug', 'mug.unit_generic_id', 'poi.unit_generic_id')
            .where('poi.purchase_order_item_id', purchaseOrderItemId)
            .whereRaw('vs.stock_date < po.order_date')
            .orderBy('vs.stock_card_id', 'DESC')
            .limit(1)
    }

    accountPayable(knex: Knex, purchaseOrderId) {
        return knex('pc_purchasing_order as pc')
            .select('pc.purchase_order_id', 'pc.purchase_order_number', 'pc.purchase_order_book_number',
                'r.receive_code', 'r.delivery_code', 'ml.labeler_id', knex.raw('sum(rd.cost*rd.receive_qty) as cost'),
                'ml.labeler_name', 'mgt.generic_type_name')
            .join('wm_receives as r', 'r.purchase_order_id', 'pc.purchase_order_id')
            .join('wm_receive_detail as rd', 'rd.receive_id', 'r.receive_id')
            .join('wm_receive_approve as ra', 'r.receive_id', 'ra.receive_id')
            .join('mm_labelers as ml', 'ml.labeler_id', 'pc.labeler_id')
            .join('mm_products as mp', 'mp.product_id', 'rd.product_id')
            .join('mm_generics as mg', 'mg.generic_id', 'mp.generic_id')
            .join('mm_generic_types as mgt', 'mgt.generic_type_id', 'mg.generic_type_id')
            .where('pc.purchase_order_status', 'COMPLETED')
            .where('pc.is_cancel', 'N')
            .where('r.is_cancel', 'N')
            .whereNotNull('pc.approved_date')
            .whereIn('pc.purchase_order_id', purchaseOrderId)
            .groupBy('r.receive_id')
    }

    orderPoint(knex: Knex, warehouseId) {
        return knex.raw(`SELECT
        mg.generic_id,
        mg.working_code,
        mg.generic_name,
        mg.min_qty,
        mg.max_qty,
        ifnull( mgp.safety_max_day, '-' ) safety_max_day,
        ifnull( mgp.safety_min_day, '-' ) safety_min_day,
        sum( rq.remain_qty ) remain_qty,
        '' issue_qty,
        ifnull( pur.total, 0 ) AS total_purchased,
        mgt.generic_type_name 
    FROM
        mm_generics AS mg
        LEFT JOIN ( SELECT generic_id, sum( remain_qty ) remain_qty FROM view_product_reserve WHERE warehouse_id = ${warehouseId} GROUP BY generic_id, warehouse_id ) AS rq ON rq.generic_id = mg.generic_id
        LEFT JOIN view_purchasing_total_remain AS pur ON pur.generic_id = mg.generic_id
        LEFT JOIN mm_generic_planning AS mgp ON mgp.generic_id = mg.generic_id 
        AND mgp.warehouse_id = ${warehouseId} 
        AND mgp.is_active = 'Y'
        LEFT JOIN mm_generic_types AS mgt ON mgt.generic_type_id = mg.generic_type_id 
    WHERE
        mg.mark_deleted = "N" 
        AND mg.is_active = "Y" 
        AND mg.generic_id NOT IN ( SELECT generic_id FROM pc_product_reserved WHERE reserved_status IN ( 'SELECTED', 'CONFIRMED' ) )
    GROUP BY
        mg.working_code 
    HAVING
        remain_qty <= mg.min_qty AND ( total_purchased >= 0 
        OR total_purchased IS NULL 
        ) 
    ORDER BY
        mg.generic_name `)
    }
}

